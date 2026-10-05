"""The lifecycle, and what supersession does and does not do."""
from conftest import CONTRACT_ADDRESS, CREATOR, FUNDER, STRANGER, SUBMITTER, \
    expect_error
from support import (OFFICIAL_URL, REPORT_URL, adjudicate, declare, freeze,
                     ready, submit, with_official, with_report)

GEN = 10 ** 18


class TestTheStatesAClaimPassesThrough:

    def test_the_whole_path_in_order(self, h):
        claim_id = declare(h)
        assert h.contract.get_claim(claim_id)["status"] == "DRAFT"

        freeze(h, claim_id, policy="OPEN_EVIDENCE")
        assert h.contract.get_claim(claim_id)["status"] == "EVIDENCE_OPEN"

        with_report(h, claim_id)
        assert h.contract.get_claim(claim_id)["status"] == "EVIDENCE_SUBMITTED"

        adjudicate(h, claim_id)
        # accepted, which is not finalized and does not pretend to be
        assert h.contract.get_claim(claim_id)["status"] == "ACCEPTED"

    def test_accepted_is_recorded_without_claiming_finality(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        adjudicate(h, claim_id, when="2026-09-28T16:21:00Z")
        claim = h.contract.get_claim(claim_id)
        assert claim["adjudicated_at"] == "2026-09-28T16:21:00Z"
        # there is no finalized_at the contract could honestly fill in: finality
        # is a fact about the transaction, which the contract cannot observe
        # about itself
        assert "finalized_at" not in claim
        assert claim["settled_at"] == ""

    def test_the_states_the_contract_can_hold_are_published(self, h):
        states = h.contract.get_protocol()["states"]
        assert "ACCEPTED" in states and "SETTLED" in states
        for state in states:
            assert state == state.upper()


class TestSupersession:

    def _decided(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        return claim_id

    def test_a_later_claim_takes_over_the_question(self, h):
        old = self._decided(h)
        new = declare(h, when="2026-09-29T09:00:00Z",
                      start="2026-09-29T00:00:00Z", end="2026-09-30T12:00:00Z")
        freeze(h, new, policy="OFFICIAL_ONLY", when="2026-09-29T09:01:00Z")
        h.to(CREATOR).at("2026-09-29T09:02:00Z")
        h.contract.supersede(old, new)

        assert h.contract.get_claim(old)["superseded_by"] == new
        assert h.contract.get_claim(new)["supersedes"] == old

    def test_it_does_not_rewrite_the_record_it_supersedes(self, h):
        old = self._decided(h)
        before = h.contract.get_claim_adjudication(old)
        verdict_before = h.contract.get_claim(old)["verdict"]

        new = declare(h, when="2026-09-29T09:00:00Z",
                      start="2026-09-29T00:00:00Z", end="2026-09-30T12:00:00Z")
        freeze(h, new, policy="OFFICIAL_ONLY", when="2026-09-29T09:01:00Z")
        h.to(CREATOR).at("2026-09-29T09:02:00Z")
        h.contract.supersede(old, new)

        after = h.contract.get_claim_adjudication(old)
        assert after == before
        assert h.contract.get_claim(old)["verdict"] == verdict_before
        # what was true of the record yesterday is still what the record says
        assert h.contract.get_claim(old)["status"] == "SUPERSEDED"

    def test_an_undecided_claim_cannot_be_superseded(self, h):
        old = ready(h)
        new = ready(h)
        h.to(CREATOR).at("2026-09-29T09:02:00Z")
        with expect_error("only a decided claim"):
            h.contract.supersede(old, new)

    def test_a_claim_cannot_supersede_itself(self, h):
        old = self._decided(h)
        h.to(CREATOR).at("2026-09-29T09:02:00Z")
        with expect_error("cannot supersede itself"):
            h.contract.supersede(old, old)

    def test_the_superseding_claim_must_be_frozen(self, h):
        old = self._decided(h)
        new = declare(h, when="2026-09-29T09:00:00Z")
        h.to(CREATOR).at("2026-09-29T09:02:00Z")
        with expect_error("must be frozen"):
            h.contract.supersede(old, new)

    def test_only_the_creator_of_the_new_claim_can_point_it_at_the_old_one(self, h):
        old = self._decided(h)
        new = declare(h, when="2026-09-29T09:00:00Z",
                      start="2026-09-29T00:00:00Z", end="2026-09-30T12:00:00Z")
        freeze(h, new, policy="OFFICIAL_ONLY", when="2026-09-29T09:01:00Z")
        h.to(STRANGER).at("2026-09-29T09:02:00Z")
        with expect_error("only the creator"):
            h.contract.supersede(old, new)

    def test_a_claim_is_superseded_once(self, h):
        old = self._decided(h)
        for when in ("2026-09-29T09:00:00Z", "2026-09-29T10:00:00Z"):
            new = declare(h, when=when, start="2026-09-29T00:00:00Z",
                          end="2026-09-30T12:00:00Z")
            freeze(h, new, policy="OFFICIAL_ONLY", when=when)
            h.to(CREATOR).at(when)
            if when.startswith("2026-09-29T09"):
                h.contract.supersede(old, new)
            else:
                with expect_error("already superseded"):
                    h.contract.supersede(old, new)


class TestCustodyAcrossEveryPath:

    def _fund(self, h, claim_id, amount=250 * GEN):
        h.to(FUNDER).at("2026-09-28T15:10:00Z").sending(amount)
        try:
            h.contract.fund_bounty(claim_id)
        finally:
            h.world.value = 0

    def test_custody_is_zero_after_settlement(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        self._fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        h.to(CONTRACT_ADDRESS).at("2026-09-28T16:30:00Z")
        h.contract.settle(claim_id)
        assert h.contract.get_custody()["escrow_held"] == "0"
        assert h.contract.get_custody()["balanced"] is True

    def test_custody_is_zero_after_cancellation(self, h):
        claim_id = ready(h)
        self._fund(h, claim_id)
        h.to(CREATOR).at("2026-09-28T15:20:00Z")
        h.contract.cancel_claim(claim_id)
        assert h.contract.get_custody()["escrow_held"] == "0"
        assert h.contract.get_custody()["balanced"] is True

    def test_custody_is_zero_after_recovery(self, h):
        claim_id = ready(h)
        self._fund(h, claim_id)
        submit(h, claim_id, OFFICIAL_URL)
        h.to(FUNDER).at("2026-10-01T00:00:00Z")
        h.contract.recover_bounty(claim_id)
        assert h.contract.get_custody()["escrow_held"] == "0"
        assert h.contract.get_custody()["balanced"] is True

    def test_one_claim_settling_leaves_another_claim_s_bounty_alone(self, h):
        paid = ready(h, policy="OPEN_EVIDENCE")
        self._fund(h, paid, amount=250 * GEN)
        with_report(h, paid)
        adjudicate(h, paid)

        untouched = ready(h)
        self._fund(h, untouched, amount=40 * GEN)

        h.to(CONTRACT_ADDRESS).at("2026-09-28T16:30:00Z")
        h.contract.settle(paid)
        assert h.payments == [(SUBMITTER, 250 * GEN)]
        assert h.contract.get_claim(untouched)["bounty_deposited"] == str(40 * GEN)
        assert h.contract.get_custody()["escrow_held"] == str(40 * GEN)
        assert h.contract.get_custody()["balanced"] is True
