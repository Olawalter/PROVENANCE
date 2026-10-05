"""Declaring a claim, and freezing it."""
from conftest import CREATOR, STRANGER, expect_error
from support import (OFFICIAL_DOMAIN, REGULATOR_DOMAIN, RELEVANT, STATEMENT,
                     SUBJECT, WINDOW_END, WINDOW_START, declare, freeze, ready)


class TestDeclaring:

    def test_a_claim_is_structure_first_and_a_sentence_second(self, h):
        claim_id = declare(h)
        claim = h.contract.get_claim(claim_id)

        # the sentence is kept for people; these are what gets adjudicated
        assert claim["subject"] == SUBJECT
        assert claim["predicate"] == "resumed_withdrawals"
        assert claim["requested_value"] == "true"
        assert claim["relevant_time"] == RELEVANT
        assert claim["statement"] == STATEMENT
        assert claim["status"] == "DRAFT"
        assert claim["creator"] == CREATOR

    def test_a_claim_starts_with_nothing_frozen(self, h):
        claim = h.contract.get_claim(declare(h))
        assert claim["source_policy"] == ""
        assert claim["frozen_at"] == ""
        assert claim["official_domains"] == []

    def test_the_creator_is_the_account_that_signed_it(self, h):
        claim = h.contract.get_claim(declare(h, by=STRANGER))
        # not an argument anybody can pass: the signature decides
        assert claim["creator"] == STRANGER

    def test_a_claim_type_outside_the_vocabulary_is_refused(self, h):
        with expect_error("claim_type"):
            declare(h, claim_type="VIBES")

    def test_the_parts_that_drive_adjudication_are_required(self, h):
        with expect_error("required"):
            declare(h, subject="  ")
        with expect_error("required"):
            declare(h, predicate="")
        with expect_error("required"):
            declare(h, value="")

    def test_a_statement_is_required_so_a_person_can_read_the_claim(self, h):
        with expect_error("statement"):
            declare(h, statement="")

    def test_a_time_that_is_not_a_time_is_refused(self, h):
        with expect_error("relevant_time"):
            declare(h, relevant="late on Monday")
        with expect_error("observation_start"):
            declare(h, start="2026-09-28")
        with expect_error("observation_end"):
            declare(h, end="2026-09-30T00:00:00")

    def test_an_impossible_date_is_not_a_date(self, h):
        with expect_error("relevant_time"):
            declare(h, relevant="2026-02-30T00:00:00Z")
        with expect_error("relevant_time"):
            declare(h, relevant="2026-13-01T00:00:00Z")

    def test_a_window_that_ends_before_it_opens_is_refused(self, h):
        with expect_error("observation_end"):
            declare(h, start=WINDOW_END, end=WINDOW_START)

    def test_claims_are_numbered_and_listed_newest_first(self, h):
        first = declare(h)
        second = declare(h)
        listed = h.contract.list_claims(0, 10)
        assert [c["claim_id"] for c in listed["items"]] == [second, first]
        assert listed["total"] == 2


class TestFreezing:

    def test_freezing_fixes_the_conditions_and_opens_the_window(self, h):
        claim_id = declare(h)
        freeze(h, claim_id, policy="OFFICIAL_ONLY")
        claim = h.contract.get_claim(claim_id)
        assert claim["source_policy"] == "OFFICIAL_ONLY"
        assert claim["official_domains"] == [OFFICIAL_DOMAIN]
        assert claim["frozen_at"] != ""
        assert claim["status"] == "EVIDENCE_OPEN"

    def test_only_the_creator_can_freeze(self, h):
        claim_id = declare(h)
        with expect_error("only the account"):
            freeze(h, claim_id, by=STRANGER)

    def test_a_frozen_claim_cannot_be_frozen_again(self, h):
        claim_id = ready(h)
        with expect_error("already frozen"):
            freeze(h, claim_id, policy="OPEN_EVIDENCE")

    def test_the_policy_cannot_be_changed_afterwards_by_anyone(self, h):
        claim_id = ready(h, policy="OFFICIAL_ONLY")
        # there is no method that takes a policy on an existing claim, and the
        # creator cannot reach one by freezing again
        with expect_error("already frozen"):
            freeze(h, claim_id, policy="OPEN_EVIDENCE")
        assert h.contract.get_claim(claim_id)["source_policy"] == "OFFICIAL_ONLY"

    def test_a_policy_outside_the_vocabulary_is_refused(self, h):
        claim_id = declare(h)
        with expect_error("source_policy"):
            freeze(h, claim_id, policy="TRUST_ME")

    def test_official_only_without_an_official_domain_is_refused(self, h):
        claim_id = declare(h)
        # the policy would otherwise be unsatisfiable by construction, and
        # nothing later could tell you why
        with expect_error("OFFICIAL_ONLY needs"):
            freeze(h, claim_id, policy="OFFICIAL_ONLY", official=[])

    def test_regulatory_without_a_regulator_domain_is_refused(self, h):
        claim_id = declare(h)
        with expect_error("REGULATORY needs"):
            freeze(h, claim_id, policy="REGULATORY", regulator=[])

    def test_multi_source_demands_more_than_one_source(self, h):
        claim_id = declare(h)
        with expect_error("MULTI_SOURCE needs"):
            freeze(h, claim_id, policy="MULTI_SOURCE", min_sources=1)

    def test_independence_cannot_exceed_the_sources_required(self, h):
        claim_id = declare(h)
        with expect_error("min_independent"):
            freeze(h, claim_id, min_sources=2, min_independent=3)

    def test_a_domain_that_is_not_a_domain_is_refused(self, h):
        claim_id = declare(h)
        with expect_error("not a domain"):
            freeze(h, claim_id, official=["https://acme-exchange.example/status"])

    def test_a_domain_is_stored_without_its_www(self, h):
        claim_id = declare(h)
        freeze(h, claim_id, official=["WWW.Acme-Exchange.Example"])
        assert h.contract.get_claim(claim_id)["official_domains"] == \
            ["acme-exchange.example"]

    def test_a_claim_frozen_before_its_window_opens_waits(self, h):
        claim_id = declare(h, when="2026-09-27T10:00:00Z")
        freeze(h, claim_id, when="2026-09-27T10:01:00Z")
        assert h.contract.get_claim(claim_id)["status"] == "REGISTERED"

    def test_a_claim_frozen_after_its_window_closes_awaits_adjudication(self, h):
        claim_id = declare(h, when="2026-10-02T10:00:00Z")
        freeze(h, claim_id, when="2026-10-02T10:01:00Z")
        assert h.contract.get_claim(claim_id)["status"] == "ADJUDICATION_PENDING"


class TestTheProtocolDescribesItself:

    def test_the_vocabulary_is_read_off_the_contract(self, h):
        info = h.contract.get_protocol()
        assert info["verdicts"] == ["CONFIRMED", "REFUTED", "CONFLICTED",
                                    "INSUFFICIENT", "UNAVAILABLE"]
        assert "OPEN_EVIDENCE" in info["source_policies"]
        assert info["rules"] == "provenance-adjudication-1"

    def test_it_says_what_it_does_not_claim(self, h):
        scope = h.contract.get_protocol()["scope"]
        assert "Not proof" in scope
