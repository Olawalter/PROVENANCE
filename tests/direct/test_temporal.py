"""Temporal provenance: five different times, kept apart.

A source published after an event does not mean the event happened after
publication. A page that changes next week does not rewrite what was observed
today. These are the cases where collapsing times into one value would give a
confident wrong answer.
"""
from conftest import STRANGER
from support import (OFFICIAL_URL, REPORT_URL, STALE_URL, adjudicate, declare,
                     freeze, ready, submit, with_official, with_report,
                     with_stale)


def record(h, claim_id):
    return h.contract.get_claim_adjudication(claim_id)


class TestTheTimesAreDistinct:

    def test_event_publication_and_observation_are_recorded_separately(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        evidence_id = with_official(h, claim_id)
        adjudicate(h, claim_id, when="2026-09-28T16:21:00Z")

        item = h.contract.get_evidence(evidence_id)
        assert item["event_time"] == "2026-09-28T13:42:00Z"
        assert item["publication_time"] == "2026-09-28T13:44:00Z"
        assert item["observation_time"] == "2026-09-28T16:21:00Z"
        assert item["submitted_at"] == "2026-09-28T15:30:00Z"
        # four distinct moments, none of them standing in for another
        assert len({item["event_time"], item["publication_time"],
                    item["observation_time"], item["submitted_at"]}) == 4

    def test_observation_time_is_the_transaction_clock_not_the_page(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        evidence_id = with_official(h, claim_id)
        adjudicate(h, claim_id, when="2026-09-29T09:00:00Z")
        # the only time a node cannot disagree about
        assert h.contract.get_evidence(evidence_id)["observation_time"] == \
            "2026-09-29T09:00:00Z"

    def test_publication_after_the_event_is_normal_not_suspicious(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_official(h, claim_id)
        adjudicate(h, claim_id)
        # 13:42 happened, 13:44 reported it. That is how announcements work.
        assert h.contract.get_claim(claim_id)["verdict"] == "CONFIRMED"


class TestTheWindow:

    def test_a_source_published_outside_the_window_does_not_count(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        url = "https://daily-ledger.example/last-year"
        h.document(url, "Acme Exchange resumed withdrawals, the company said.")
        h.says(url, position="SUPPORTS", source_class="SECONDARY",
               quote="Acme Exchange resumed withdrawals, the company said",
               event_time="2025-04-01T10:00:00Z",
               publication_time="2025-04-01T10:30:00Z")
        submit(h, claim_id, url)
        adjudicate(h, claim_id)
        written = record(h, claim_id)
        assert written["timely"] == 0
        assert written["verdict"] == "INSUFFICIENT"

    def test_a_stale_source_contradicts_nothing(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        with_stale(h, claim_id)
        adjudicate(h, claim_id)
        written = record(h, claim_id)
        # the halt was real, and it was two days before the window. Treating it
        # as a contradiction would make every claim about a changed state
        # conflicted forever.
        assert written["contradicting"] == 0
        assert written["verdict"] == "CONFIRMED"

    def test_the_stale_source_is_still_shown_with_a_role(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        stale = with_stale(h, claim_id)
        adjudicate(h, claim_id)
        # not hidden, not counted: the record says it was read and disregarded
        item = h.contract.get_evidence(stale)
        assert item["status"] == "READ"
        assert item["role"] == "DISREGARDED"
        assert item["position"] == "CONTRADICTS"

    def test_a_source_with_no_publication_time_is_not_assumed_stale(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        url = "https://daily-ledger.example/undated"
        h.document(url, "Acme Exchange withdrawals resumed at 13:42 UTC on 28 "
                        "September 2026.")
        h.says(url, position="SUPPORTS", source_class="SECONDARY",
               quote="withdrawals resumed at 13:42 UTC on 28 September",
               event_time="2026-09-28T13:42:00Z", publication_time="")
        submit(h, claim_id, url)
        adjudicate(h, claim_id)
        # an undated page is not evidence of being out of date
        assert h.contract.get_claim(claim_id)["verdict"] == "CONFIRMED"


class TestTemporalFacts:

    def test_a_temporal_fact_needs_the_event_before_the_moment_claimed(self, h):
        claim_id = declare(h, claim_type="TEMPORAL_FACT")
        freeze(h, claim_id, policy="OPEN_EVIDENCE")
        url = "https://daily-ledger.example/late"
        h.document(url, "Acme Exchange withdrawals resumed at 18:10 UTC on 28 "
                        "September 2026, hours later than expected.")
        h.says(url, position="SUPPORTS", source_class="SECONDARY",
               quote="withdrawals resumed at 18:10 UTC on 28 September",
               event_time="2026-09-28T18:10:00Z",
               publication_time="2026-09-28T18:40:00Z")
        submit(h, claim_id, url)
        adjudicate(h, claim_id)
        # the claim was "before 14:00". The source says 18:10, and says it
        # supports the resumption -- but not the claim as frozen.
        assert record(h, claim_id)["timely"] == 0
        assert h.contract.get_claim(claim_id)["verdict"] == "INSUFFICIENT"

    def test_the_same_source_inside_the_moment_satisfies_it(self, h):
        claim_id = declare(h, claim_type="TEMPORAL_FACT")
        freeze(h, claim_id, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert h.contract.get_claim(claim_id)["verdict"] == "CONFIRMED"


class TestTimesThatAreNotTimes:

    def test_a_time_the_protocol_cannot_compare_is_not_recorded(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        url = "https://daily-ledger.example/vague"
        h.document(url, "Acme Exchange withdrawals resumed on Monday afternoon, "
                        "the company said.")
        h.says(url, position="SUPPORTS", source_class="SECONDARY",
               quote="withdrawals resumed on Monday afternoon",
               event_time="Monday afternoon", publication_time="recently")
        evidence_id = submit(h, claim_id, url)
        adjudicate(h, claim_id)
        item = h.contract.get_evidence(evidence_id)
        # a stored "Monday afternoon" would look like data and compare like
        # nothing, so it is not stored at all
        assert item["event_time"] == ""
        assert item["publication_time"] == ""
        assert item["position"] == "SUPPORTS"
