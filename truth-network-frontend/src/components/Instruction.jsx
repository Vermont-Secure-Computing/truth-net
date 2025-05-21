import React from "react";

export default function InstructionsPage() {
  return (
    <div className="container mx-auto px-6 py-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-center">TRUTH IT NETWORK INSTRUCTIONS</h1>
      <p className="mb-6">
        Please read all instructions. This is an open source project, there is no guarantee of any kind provided by the authors of the software. Please understand and be aware of all risks related with smart contract errors. Use at your own risk!
      </p>

      <h2 className="text-xl font-semibold mb-2">TRUTH PROVIDER INSTRUCTIONS</h2>
      <ol className="list-decimal list-inside space-y-4 mb-6">
        <li>
          Register an address by pressing “Join Network” and depositing the required coin. The deposit is returned in full at any time by pressing “Leave Network”. A small “rent” payment for storing your registration data is also required by the Solana network. This will be returned with your deposit when you leave the network. An address can rejoin the network at any time by re-depositing the required deposit.
        </li>
        <li>
          The questions available for voting and the total rewards are displayed.
          <br />
          Voting requires two separate actions:
          <ul className="list-disc list-inside ml-6 mt-2">
            <li>A “commit” in which your vote is committed and hidden with a password</li>
            <li>A “reveal” in which your password is used to reveal your vote</li>
          </ul>
          <p className="mt-2">
            Both actions must be made in the required time periods in order to be eligible for your share of the question’s reward.
          </p>
          <p className="mt-2">
            The reputation score associated with an address increases with both revealed votes (any revealed vote) and with those votes which are in agreement with consensus (“correct votes”). Only these correct votes are rewarded with the funds placed in the question address.
          </p>
          <p className="mt-2">
            Funds can be added to the address associated with a question at any time before funds are distributed, by any party.
          </p>
          <p className="mt-2">
            A question can be deleted by the question creator at any time after the funds are distributed, upon which the rent payment associated with the data of the question can be reclaimed.
          </p>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mb-2">GUIDELINES</h2>
      <ul className="list-disc list-inside space-y-2">
        <li><strong>Question creators:</strong> Make sure your question is in the form of a true or false statement.</li>
        <li><strong>Truth providers:</strong> To receive your reward you must vote with the majority.</li>
        <li><strong>You can access devnet </strong><a
          href="https://devnet.truth.it.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          here
        </a></li>
      </ul>
    </div>
  );
}
