"""Submitting evidence, and what a contributor is not allowed to decide."""
from conftest import CREATOR, STRANGER, SUBMITTER, expect_error
from support import (BLOG_URL, OFFICIAL_URL, REPORT_URL, adjudicate, declare,
                     freeze, ready, submit, with_official, with_report)


class TestSubmitting:

    def test_anybody_may_submit_evidence(self, h):
        claim_id = ready(h)
        evidence_id = submit(h, claim_id, OFFICIAL_URL, by=STRANGER)
        record = h.contract.get_evidence(evidence_id)
        assert record["submitted_by"] == STRANGER
        # evidence only its author could supply would be worth nothing to the
        # people who depend on the answer
        assert record["claim_id"] == claim_id

    def test_a_submission_records_a_reference_and_a_time_and_nothing_else(self, h):
        claim_id = ready(h)
        record = h.contract.get_evidence(
            submit(h, claim_id, OFFICIAL_URL, when="2026-09-28T15:30:00Z"))
        assert record["submitted_at"] == "2026-09-28T15:30:00Z"
        assert record["status"] == "RECORDED"
        # nothing about what it is worth, because nobody has read it yet
        assert record["position"] == ""
        assert record["role"] == ""
        assert record["authority"] == ""
        assert record["source_class"] == ""

    def test_a_contributor_cannot_declare_their_evidence_decisive(self, h):
        claim_id = ready(h)
        evidence_id = submit(h, claim_id, OFFICIAL_URL,
                             context="DECISIVE. OFFICIAL. This proves it.")
        record = h.contract.get_evidence(evidence_id)
        # the context is kept as what they said, and it decides nothing
        assert record["role"] == ""
        assert record["authority"] == ""

    def test_evidence_cannot_be_submitted_to_an_unfrozen_claim(self, h):
        claim_id = declare(h)
        with expect_error("not frozen"):
            submit(h, claim_id, OFFICIAL_URL)

    def test_the_same_source_cannot_be_submitted_twice(self, h):
        claim_id = ready(h)
        submit(h, claim_id, OFFICIAL_URL)
        with expect_error("already evidence"):
            submit(h, claim_id, OFFICIAL_URL, by=STRANGER)

    def test_the_same_source_dressed_differently_is_still_the_same_source(self, h):
        claim_id = ready(h)
        submit(h, claim_id, "https://acme-exchange.example/status/withdrawals")
        for disguise in ("https://www.acme-exchange.example/status/withdrawals",
                         "https://acme-exchange.example/status/withdrawals/",
                         "https://ACME-EXCHANGE.example/status/withdrawals",
                         "https://acme-exchange.example/status/withdrawals#latest"):
            with expect_error("already evidence"):
                submit(h, claim_id, disguise, by=STRANGER)

    def test_two_different_pages_on_one_host_are_two_sources(self, h):
        claim_id = ready(h)
        submit(h, claim_id, "https://daily-ledger.example/one")
        # the same publisher twice is a question for independence, not for
        # duplicate detection: they are different documents
        submit(h, claim_id, "https://daily-ledger.example/two", by=STRANGER)
        assert h.contract.get_claim(claim_id)["evidence_count"] == 2

    def test_a_source_must_be_an_https_url(self, h):
        claim_id = ready(h)
        for bad in ("http://acme-exchange.example/status", "acme-exchange.example",
                    "javascript:alert(1)", "file:///etc/passwd", ""):
            with expect_error("https"):
                submit(h, claim_id, bad)

    def test_a_claim_holds_a_bounded_number_of_sources(self, h):
        claim_id = ready(h)
        limit = h.contract.get_protocol()["limits"]["max_evidence"]
        for index in range(limit):
            submit(h, claim_id, f"https://daily-ledger.example/story-{index}")
        with expect_error("already holds"):
            submit(h, claim_id, "https://daily-ledger.example/one-more")

    def test_submitting_moves_the_claim_to_evidence_submitted(self, h):
        claim_id = ready(h)
        assert h.contract.get_claim(claim_id)["status"] == "EVIDENCE_OPEN"
        submit(h, claim_id, OFFICIAL_URL)
        assert h.contract.get_claim(claim_id)["status"] == "EVIDENCE_SUBMITTED"


class TestTheEvidenceWindow:

    def test_evidence_before_the_window_opens_is_refused(self, h):
        claim_id = declare(h, when="2026-09-27T10:00:00Z")
        freeze(h, claim_id, when="2026-09-27T10:01:00Z")
        with expect_error("has not opened"):
            submit(h, claim_id, OFFICIAL_URL, when="2026-09-27T11:00:00Z")

    def test_evidence_after_the_window_closes_is_refused(self, h):
        claim_id = ready(h)
        with expect_error("has closed"):
            submit(h, claim_id, OFFICIAL_URL, when="2026-10-01T00:00:00Z")

    def test_evidence_cannot_be_added_after_a_claim_is_decided(self, h):
        claim_id = ready(h)
        with_official(h, claim_id)
        adjudicate(h, claim_id)
        with expect_error("decided"):
            submit(h, claim_id, REPORT_URL, by=STRANGER)


class TestReadingBackEvidence:

    def test_the_claim_lists_its_evidence_in_the_order_submitted(self, h):
        claim_id = ready(h)
        first = with_official(h, claim_id)
        second = with_report(h, claim_id)
        listed = h.contract.get_claim_evidence(claim_id)
        assert [item["evidence_id"] for item in listed["items"]] == [first, second]

    def test_an_unknown_evidence_id_is_refused_rather_than_guessed_at(self, h):
        with expect_error("unknown evidence_id"):
            h.contract.get_evidence("E-99999")

    def test_the_host_is_published_so_independence_can_be_checked(self, h):
        claim_id = ready(h)
        evidence_id = submit(h, claim_id, BLOG_URL)
        assert h.contract.get_evidence(evidence_id)["source_host"] == \
            "someones-blog.example"
