"""Source policy, authority, independence, and the verdicts they produce.

These are the questions the specification insists on keeping apart: a source
existing, being relevant, being authoritative, satisfying the policy, and
supporting the claim are five different things, and this file asks them
separately.
"""
from conftest import CREATOR, STRANGER, SUBMITTER, expect_error
from support import (BLOG_URL, OFFICIAL_URL, REGULATOR_URL, REPORT_URL,
                     SECOND_REPORT_TEXT, SECOND_REPORT_URL, STALE_URL,
                     adjudicate, ready, submit, with_official, with_regulator,
                     with_report, with_stale)


def verdict(h, claim_id):
    return h.contract.get_claim(claim_id)["verdict"]


def record(h, claim_id):
    return h.contract.get_claim_adjudication(claim_id)


class TestAuthorityIsFrozenNotJudged:

    def test_authority_comes_from_the_domains_frozen_with_the_claim(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        official = with_official(h, claim_id)
        report = with_report(h, claim_id)
        regulator = with_regulator(h, claim_id)
        adjudicate(h, claim_id)

        assert h.contract.get_evidence(official)["authority"] == "OFFICIAL"
        assert h.contract.get_evidence(regulator)["authority"] == "REGULATOR"
        assert h.contract.get_evidence(report)["authority"] == "OTHER"

    def test_a_subdomain_of_a_frozen_domain_carries_its_authority(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        url = "https://status.acme-exchange.example/withdrawals"
        h.document(url, "Withdrawals resumed at 13:42 UTC on 28 September 2026.")
        h.says(url, position="SUPPORTS", source_class="PRIMARY",
               quote="Withdrawals resumed at 13:42 UTC on 28 September",
               event_time="2026-09-28T13:42:00Z",
               publication_time="2026-09-28T13:44:00Z")
        evidence_id = submit(h, claim_id, url)
        adjudicate(h, claim_id)
        assert h.contract.get_evidence(evidence_id)["authority"] == "OFFICIAL"

    def test_a_lookalike_domain_does_not(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        # acme-exchange.example.evil.test ends with the frozen domain as a
        # string but is a different site, and the comparison is on labels
        url = "https://acme-exchange.example.evil.test/status"
        h.document(url, "Withdrawals resumed at 13:42 UTC on 28 September 2026.")
        h.says(url, position="SUPPORTS", source_class="PRIMARY",
               quote="Withdrawals resumed at 13:42 UTC on 28 September")
        evidence_id = submit(h, claim_id, url)
        adjudicate(h, claim_id)
        assert h.contract.get_evidence(evidence_id)["authority"] == "OTHER"

    def test_a_model_calling_a_blog_official_changes_nothing(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        h.document(BLOG_URL, "I can confirm Acme resumed withdrawals at 13:42 UTC.")
        # the model is not asked about authority at all, and if it volunteers
        # something the contract never reads it
        h.says(BLOG_URL, position="SUPPORTS", source_class="PRIMARY",
               quote="Acme resumed withdrawals at 13:42 UTC",
               publication_time="2026-09-28T14:00:00Z")
        submit(h, claim_id, BLOG_URL)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "INSUFFICIENT"
        assert record(h, claim_id)["qualifying"] == 0


class TestOfficialOnly:

    def test_the_official_source_confirms_it(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        with_official(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "CONFIRMED"
        assert record(h, claim_id)["source_policy_satisfied"] is True

    def test_press_coverage_alone_does_not_satisfy_it(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        with_report(h, claim_id)
        with_report(h, claim_id, url=SECOND_REPORT_URL, text=SECOND_REPORT_TEXT,
                    quote="withdrawals were working again by mid-afternoon")
        adjudicate(h, claim_id)
        # the reporting may well be right. It is not what was frozen.
        assert verdict(h, claim_id) == "INSUFFICIENT"
        assert record(h, claim_id)["qualifying"] == 0

    def test_the_official_source_refuting_it_is_refuted(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        h.document(OFFICIAL_URL, "Withdrawals remain suspended as of 28 September "
                                 "2026 and have not resumed.")
        h.says(OFFICIAL_URL, position="CONTRADICTS", source_class="PRIMARY",
               quote="Withdrawals remain suspended as of 28 September",
               publication_time="2026-09-28T15:00:00Z")
        submit(h, claim_id, OFFICIAL_URL)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "REFUTED"


class TestRegulatory:

    def test_only_the_regulator_counts(self, h):
        claim_id = ready(h, policy="REGULATORY")
        with_official(h, claim_id)
        adjudicate(h, claim_id)
        # the exchange's own page is not the authority this policy named
        assert verdict(h, claim_id) == "INSUFFICIENT"

    def test_the_regulator_confirms_it(self, h):
        claim_id = ready(h, policy="REGULATORY")
        with_regulator(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "CONFIRMED"


class TestMultiSource:

    def test_two_independent_hosts_confirm_it(self, h):
        claim_id = ready(h, policy="MULTI_SOURCE", min_sources=2, min_independent=2)
        with_report(h, claim_id)
        with_report(h, claim_id, url=SECOND_REPORT_URL, text=SECOND_REPORT_TEXT,
                    quote="withdrawals were working again by mid-afternoon")
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "CONFIRMED"
        assert record(h, claim_id)["independent_supporting"] == 2

    def test_two_pages_from_one_publisher_are_one_source(self, h):
        claim_id = ready(h, policy="MULTI_SOURCE", min_sources=2, min_independent=2)
        with_report(h, claim_id)
        with_report(h, claim_id, url="https://daily-ledger.example/follow-up",
                    text="Our earlier report stands: withdrawals resumed at 13:42 "
                         "UTC on 28 September 2026.",
                    quote="withdrawals resumed at 13:42 UTC on 28 September")
        adjudicate(h, claim_id)
        # counting URLs would have called this corroborated. It is one newsroom
        # saying the same thing twice.
        assert record(h, claim_id)["supporting"] == 2
        assert record(h, claim_id)["independent_supporting"] == 1
        assert verdict(h, claim_id) == "INSUFFICIENT"

    def test_one_source_is_not_multiple_sources(self, h):
        claim_id = ready(h, policy="MULTI_SOURCE", min_sources=2, min_independent=2)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "INSUFFICIENT"


class TestPrimaryPlusCorroboration:

    def test_the_primary_record_plus_an_independent_report_confirms_it(self, h):
        claim_id = ready(h)   # PRIMARY_PLUS_CORROBORATION
        with_official(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "CONFIRMED"

    def test_a_primary_record_on_its_own_is_not_corroborated(self, h):
        claim_id = ready(h)
        with_official(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "INSUFFICIENT"
        assert record(h, claim_id)["source_policy_satisfied"] is False

    def test_corroboration_without_a_primary_record_is_not_enough(self, h):
        claim_id = ready(h)
        with_report(h, claim_id)
        with_report(h, claim_id, url=SECOND_REPORT_URL, text=SECOND_REPORT_TEXT,
                    quote="withdrawals were working again by mid-afternoon")
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "INSUFFICIENT"

    def test_every_source_that_carried_it_is_recorded_as_decisive(self, h):
        claim_id = ready(h)
        official = with_official(h, claim_id)
        report = with_report(h, claim_id)
        adjudicate(h, claim_id)
        # Both counted, and together they satisfied the policy; neither one
        # would have. What kind of document each was is recorded separately and
        # shown, and it does not decide the role -- making it decide would mean
        # validators had to agree about it, which costs rounds and settles
        # nothing.
        assert h.contract.get_evidence(official)["role"] == "DECISIVE"
        assert h.contract.get_evidence(report)["role"] == "DECISIVE"
        assert h.contract.get_evidence(official)["source_class"] == "PRIMARY"
        assert h.contract.get_evidence(report)["source_class"] == "SECONDARY"

    def test_a_source_counted_toward_a_verdict_it_did_not_carry_corroborates(self, h):
        claim_id = ready(h)
        report = with_report(h, claim_id)   # no primary record: INSUFFICIENT
        adjudicate(h, claim_id)
        assert h.contract.get_claim(claim_id)["verdict"] == "INSUFFICIENT"
        assert h.contract.get_evidence(report)["role"] == "CORROBORATING"


class TestOpenEvidence:

    def test_any_public_source_can_establish_it(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "CONFIRMED"

    def test_silence_is_still_not_a_promise(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        h.document(BLOG_URL, "A long essay about exchange architecture in general.")
        h.says(BLOG_URL, position="SILENT")
        submit(h, claim_id, BLOG_URL)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "INSUFFICIENT"


class TestConflict:

    def test_two_official_sources_disagreeing_cannot_be_resolved(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        with_official(h, claim_id)
        other = "https://acme-exchange.example/newsroom/withdrawals-update"
        h.document(other, "Withdrawals did not resume on 28 September 2026 and "
                          "remain suspended pending review.")
        h.says(other, position="CONTRADICTS", source_class="PRIMARY",
               quote="Withdrawals did not resume on 28 September",
               publication_time="2026-09-28T15:30:00Z")
        submit(h, claim_id, other, by=STRANGER)
        adjudicate(h, claim_id)
        # nothing in the frozen policy ranks one above the other, and the
        # protocol says so rather than picking
        assert verdict(h, claim_id) == "CONFLICTED"
        assert record(h, claim_id)["conflict_status"] == "UNRESOLVED"

    def test_a_conflict_is_reported_with_both_sides_visible(self, h):
        claim_id = ready(h, policy="MULTI_SOURCE", min_sources=2, min_independent=2)
        with_report(h, claim_id)
        contrary = "https://market-wire.example/acme-still-halted"
        h.document(contrary, "Acme Exchange withdrawals were still unavailable at "
                             "16:00 UTC on 28 September 2026, traders said.")
        h.says(contrary, position="CONTRADICTS", source_class="SECONDARY",
               quote="withdrawals were still unavailable at 16:00 UTC",
               publication_time="2026-09-28T16:10:00Z")
        submit(h, claim_id, contrary, by=STRANGER)
        adjudicate(h, claim_id)
        written = record(h, claim_id)
        assert written["verdict"] == "CONFLICTED"
        assert written["supporting"] == 1 and written["contradicting"] == 1
        # the inconvenient source is not hidden: it is in the record with a role
        assert any(r["role"] == "CONTRADICTORY"
                   for r in h.contract.get_claim_evidence(claim_id)["items"])

    def test_the_primary_record_outranks_a_report_of_itself(self, h):
        claim_id = ready(h)   # PRIMARY_PLUS_CORROBORATION
        with_official(h, claim_id)
        with_report(h, claim_id)
        garbled = "https://market-wire.example/acme-confusion"
        h.document(garbled, "Acme Exchange withdrawals did not resume on 28 "
                            "September 2026, according to one trader.")
        h.says(garbled, position="CONTRADICTS", source_class="SECONDARY",
               quote="withdrawals did not resume on 28 September",
               publication_time="2026-09-28T17:00:00Z")
        submit(h, claim_id, garbled, by=STRANGER)
        adjudicate(h, claim_id)
        # this policy ranks a primary record above a report, so the conflict is
        # material and recorded, but resolvable
        written = record(h, claim_id)
        assert written["conflict_status"] == "MATERIAL_CONFLICT"
        assert written["verdict"] == "CONFIRMED"


class TestUnavailable:

    def test_a_claim_whose_every_source_is_unreachable_is_unavailable(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        h.document(OFFICIAL_URL, "unused")
        submit(h, claim_id, OFFICIAL_URL)
        h.down(OFFICIAL_URL)
        adjudicate(h, claim_id)
        assert verdict(h, claim_id) == "UNAVAILABLE"
        assert record(h, claim_id)["result"] == "SOURCE_UNAVAILABLE"

    def test_an_unreachable_source_is_recorded_as_such(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        reachable = with_report(h, claim_id)
        h.document(OFFICIAL_URL, "unused")
        gone = submit(h, claim_id, OFFICIAL_URL, by=STRANGER)
        h.down(OFFICIAL_URL)
        adjudicate(h, claim_id)
        assert h.contract.get_evidence(gone)["status"] == "UNREACHABLE"
        assert h.contract.get_evidence(reachable)["status"] == "READ"
        assert record(h, claim_id)["evidence_unreachable"] == 1
