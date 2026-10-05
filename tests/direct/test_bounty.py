"""Custody, and the order in which money moves.

The specification requires three distinct accounts here, and it is right to: the
mistakes this file is looking for are exactly the ones that hide when the
creator, the depositor and the contributor are the same address.
"""
from conftest import CONTRACT_ADDRESS, CREATOR, FUNDER, STRANGER, SUBMITTER, \
    expect_error
from support import (OFFICIAL_URL, REPORT_URL, adjudicate, declare, freeze,
                     ready, submit, with_official, with_report)

GEN = 10 ** 18
SOON = "2026-09-28T16:05:00Z"        # inside the finality grace
LATER = "2026-09-28T16:30:00Z"       # past it
MUCH_LATER = "2026-09-28T17:30:00Z"


def fund(h, claim_id, amount=250 * GEN, by=FUNDER, when="2026-09-28T15:10:00Z"):
    h.to(by).at(when).sending(amount)
    try:
        return h.contract.fund_bounty(claim_id)
    finally:
        h.world.value = 0


def test_the_three_accounts_really_are_distinct():
    assert CREATOR != FUNDER
    assert FUNDER != SUBMITTER
    assert CREATOR != SUBMITTER


class TestTakingCustody:

    def test_the_amount_is_what_arrived_not_what_was_claimed(self, h):
        claim_id = ready(h)
        fund(h, claim_id, amount=250 * GEN)
        claim = h.contract.get_claim(claim_id)
        # there is no amount argument anywhere in the signature to disagree with
        assert claim["bounty_deposited"] == str(250 * GEN)
        assert claim["bounty_wei"] == str(250 * GEN)

    def test_the_depositor_is_the_account_that_sent_it(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        claim = h.contract.get_claim(claim_id)
        assert claim["bounty_depositor"] == FUNDER
        assert claim["creator"] == CREATOR
        # the creator is not assumed to be the depositor anywhere
        assert claim["bounty_depositor"] != claim["creator"]

    def test_a_bounty_with_nothing_attached_is_refused(self, h):
        claim_id = ready(h)
        with expect_error("needs value"):
            fund(h, claim_id, amount=0)

    def test_funding_an_unknown_claim_returns_the_value(self, h):
        h.to(FUNDER).at("2026-09-28T15:10:00Z").sending(5 * GEN)
        h.contract.fund_bounty("C-99999")
        h.world.value = 0
        # a refusal that raised would keep the money; this one hands it back in
        # the same call
        assert h.payments == [(FUNDER, 5 * GEN)]

    def test_a_second_bounty_is_returned_rather_than_absorbed(self, h):
        claim_id = ready(h)
        fund(h, claim_id, amount=250 * GEN)
        fund(h, claim_id, amount=10 * GEN, by=STRANGER)
        assert h.payments == [(STRANGER, 10 * GEN)]
        assert h.contract.get_claim(claim_id)["bounty_deposited"] == str(250 * GEN)

    def test_custody_adds_up(self, h):
        first = ready(h)
        fund(h, first, amount=250 * GEN)
        second = ready(h)
        fund(h, second, amount=40 * GEN, by=STRANGER)
        custody = h.contract.get_custody()
        assert custody["escrow_held"] == str(290 * GEN)
        assert custody["sum_of_claims"] == str(290 * GEN)
        assert custody["balanced"] is True


class TestSettlement:

    def test_settlement_is_scheduled_on_finality_not_performed_immediately(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)

        # the adjudication did not pay anybody. It asked the protocol to call
        # back once the decision is final.
        assert h.payments == []
        assert h.scheduled == [("finalized", "settle", (claim_id,))]
        assert h.contract.get_claim(claim_id)["status"] == "ACCEPTED"

    def test_the_contributor_whose_evidence_carried_it_is_paid(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id, amount=250 * GEN)
        with_report(h, claim_id)            # submitted by SUBMITTER
        adjudicate(h, claim_id)
        h.to(CONTRACT_ADDRESS).at(LATER)
        h.contract.settle(claim_id)
        assert h.payments == [(SUBMITTER, 250 * GEN)]
        assert h.contract.get_claim(claim_id)["status"] == "SETTLED"

    def test_an_unestablished_claim_returns_the_bounty_to_its_depositor(self, h):
        claim_id = ready(h, policy="MULTI_SOURCE", min_sources=2, min_independent=2)
        fund(h, claim_id, by=FUNDER)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert h.contract.get_claim(claim_id)["verdict"] == "INSUFFICIENT"
        h.to(CONTRACT_ADDRESS).at(LATER)
        h.contract.settle(claim_id)
        # back to the depositor, not to the creator, and not to the contributor
        assert h.payments == [(FUNDER, 250 * GEN)]

    def test_the_creator_cannot_collect_their_own_bounty_with_their_own_evidence(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id, by=FUNDER)
        h.document(REPORT_URL, "Acme Exchange withdrawals resumed at 13:42 UTC on "
                               "28 September 2026.")
        h.says(REPORT_URL, position="SUPPORTS", source_class="SECONDARY",
               quote="withdrawals resumed at 13:42 UTC on 28 September",
               publication_time="2026-09-28T14:30:00Z")
        submit(h, claim_id, REPORT_URL, by=CREATOR)
        adjudicate(h, claim_id)
        h.to(CONTRACT_ADDRESS).at(LATER)
        h.contract.settle(claim_id)
        # the claim was confirmed, and by the creator's own evidence: that is
        # not a bounty anybody earned
        assert h.contract.get_claim(claim_id)["verdict"] == "CONFIRMED"
        assert h.payments == [(FUNDER, 250 * GEN)]

    def test_the_ledger_is_zero_before_a_single_unit_moves(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)

        seen = {}
        contract = h.contract
        original = contract._send_gen

        def watch(to_address, amount):
            # read the state as it stands at the moment of the transfer
            seen["deposited"] = int(contract.claims[claim_id].bounty_deposited)
            seen["escrow"] = int(contract.escrow_held)
            return original(to_address, amount)

        contract._send_gen = watch
        h.to(CONTRACT_ADDRESS).at(LATER)
        contract.settle(claim_id)
        assert seen["deposited"] == 0
        assert seen["escrow"] == 0

    def test_a_second_settlement_fails_before_it_can_pay(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        h.to(CONTRACT_ADDRESS).at(LATER)
        h.contract.settle(claim_id)
        paid = list(h.payments)
        with expect_error("already settled"):
            h.contract.settle(claim_id)
        assert h.payments == paid

    def test_settling_by_hand_waits_for_the_finality_grace(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id, when="2026-09-28T16:00:00Z")
        h.to(STRANGER).at(SOON)
        with expect_error("finality grace"):
            h.contract.settle(claim_id)
        assert h.payments == []

    def test_and_opens_once_the_grace_has_passed(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id, when="2026-09-28T16:00:00Z")
        h.to(STRANGER).at(MUCH_LATER)
        h.contract.settle(claim_id)
        # the recovery path exists so funds cannot be stranded by a message
        # that never arrives, and it still cannot jump the wait
        assert h.payments == [(SUBMITTER, 250 * GEN)]

    def test_a_claim_with_no_bounty_schedules_nothing(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        assert h.scheduled == []
        with expect_error("no bounty"):
            h.contract.settle(claim_id)

    def test_an_undecided_claim_cannot_be_settled(self, h):
        claim_id = ready(h)
        fund(h, claim_id)
        with expect_error("no accepted adjudication"):
            h.contract.settle(claim_id)


class TestCancellation:

    def test_a_creator_can_cancel_a_claim_nobody_has_answered(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        h.to(CREATOR).at("2026-09-28T15:20:00Z")
        h.contract.cancel_claim(claim_id)
        assert h.payments == [(FUNDER, 250 * GEN)]
        assert h.contract.get_claim(claim_id)["status"] == "CANCELLED"

    def test_a_claim_with_evidence_on_it_cannot_be_cancelled(self, h):
        claim_id = ready(h)
        fund(h, claim_id)
        submit(h, claim_id, OFFICIAL_URL, by=SUBMITTER)
        h.to(CREATOR).at("2026-09-28T15:40:00Z")
        with expect_error("evidence has been submitted"):
            h.contract.cancel_claim(claim_id)
        assert h.payments == []

    def test_only_the_creator_can_cancel(self, h):
        claim_id = ready(h)
        fund(h, claim_id)
        h.to(STRANGER).at("2026-09-28T15:20:00Z")
        with expect_error("only the account"):
            h.contract.cancel_claim(claim_id)

    def test_cancelling_pays_the_depositor_not_the_creator(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        h.to(CREATOR).at("2026-09-28T15:20:00Z")
        h.contract.cancel_claim(claim_id)
        assert h.payments == [(FUNDER, 250 * GEN)]

    def test_a_cancelled_claim_cannot_be_cancelled_again(self, h):
        claim_id = ready(h)
        fund(h, claim_id)
        h.to(CREATOR).at("2026-09-28T15:20:00Z")
        h.contract.cancel_claim(claim_id)
        paid = list(h.payments)
        with expect_error("decided"):
            h.contract.cancel_claim(claim_id)
        assert h.payments == paid


class TestRecovery:

    def test_a_bounty_on_a_claim_nobody_adjudicated_goes_back(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        submit(h, claim_id, OFFICIAL_URL)
        h.to(FUNDER).at("2026-10-01T00:00:00Z")
        h.contract.recover_bounty(claim_id)
        assert h.payments == [(FUNDER, 250 * GEN)]

    def test_recovery_waits_until_the_window_has_been_closed_a_while(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        h.to(FUNDER).at("2026-09-30T00:05:00Z")
        with expect_error("has not been closed long enough"):
            h.contract.recover_bounty(claim_id)

    def test_a_stranger_cannot_recover_somebody_else_s_bounty(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        h.to(STRANGER).at("2026-10-01T00:00:00Z")
        with expect_error("only the depositor or the creator"):
            h.contract.recover_bounty(claim_id)

    def test_the_creator_may_trigger_recovery_but_not_receive_it(self, h):
        claim_id = ready(h)
        fund(h, claim_id, by=FUNDER)
        h.to(CREATOR).at("2026-10-01T00:00:00Z")
        h.contract.recover_bounty(claim_id)
        # triggering a refund is not the same as being owed one
        assert h.payments == [(FUNDER, 250 * GEN)]

    def test_recovery_cannot_take_a_bounty_that_was_already_settled(self, h):
        claim_id = ready(h, policy="OPEN_EVIDENCE")
        fund(h, claim_id)
        with_report(h, claim_id)
        adjudicate(h, claim_id)
        h.to(CONTRACT_ADDRESS).at(LATER)
        h.contract.settle(claim_id)
        paid = list(h.payments)
        h.to(FUNDER).at("2026-10-01T00:00:00Z")
        with expect_error("decided"):
            h.contract.recover_bounty(claim_id)
        assert h.payments == paid
