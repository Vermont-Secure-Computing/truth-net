import React from "react";

export default function InstructionsPage() {
  return (
    <div className="container mx-auto px-6 py-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-center">TRUTH IT NETWORK INSTRUCTIONS</h1>
      <p className="mb-6">
        Please read all instructions carefully. This is an open-source project. There is no guarantee of any kind provided by the authors of the software. Please understand and be aware of all risks related to smart contract errors. <strong>Use at your own risk!</strong>
      </p>

      <h2 className="text-xl font-semibold mb-2">TRUTH PROVIDER INSTRUCTIONS</h2>
      <ol className="list-decimal list-inside space-y-4 mb-6">
        <li>
          Register an address by pressing <strong>“Join Network.”</strong> A small “rent” payment is required for storing your registration data on the Solana network. This rent will be returned if you choose to leave the network. An address can leave and rejoin the network at any time.
          <p className="mt-2">
            <strong>Enrollment Policy:</strong>
          </p>
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li>The <strong>first 33 users</strong> can join the network without an invite.</li>
            <li>After the first 33 users, you must be invited by an existing Truth Provider.</li>
            <li>You can message any active user to request an invitation.</li>
            <li>A user earns <strong>1 invite</strong> by meeting all of the following:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>They have voted correctly on at least 3 questions.</li>
                <li>All 3 questions were created and concluded within <strong>1 day</strong> (from creation to reveal end).</li>
              </ul>
            </li>
          </ul>
        </li>
        <li>
          The questions available for voting and the total rewards are displayed.
          <br />
          Voting requires two separate actions:
          <ul className="list-disc list-inside ml-6 mt-2">
            <li>A <strong>commit</strong>, where your vote is committed and hidden with a password.</li>
            <li>A <strong>reveal</strong>, where your password is used to reveal your vote.</li>
          </ul>
          <p className="mt-2">
            Both actions must be completed within the required time periods to be eligible for your share of the question’s reward.
          </p>
          <p className="mt-2">
            The reputation score associated with your address increases with all revealed votes and with votes that agree with the consensus (“correct votes”). Only correct votes are rewarded with the funds placed in the question address.
          </p>
          <p className="mt-2">
            Funds can be added to a question’s address at any time before funds are distributed, by any party.
          </p>
          <p className="mt-2">
            A question can be deleted by the creator after funds are distributed, upon which the rent payment associated with the question’s data can be reclaimed.
          </p>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mb-2">GUIDELINES</h2>
      <ul className="list-disc list-inside space-y-2 mb-6">
        <li><strong>Question creators:</strong> Make sure your question is in the form of a clear true or false statement.</li>
        <li><strong>Truth providers:</strong> To receive your reward, your revealed vote must align with the majority.</li>
        <li><strong>Invitations:</strong> Invite new participants carefully to maintain the integrity of the network.</li>
        <li>
          <strong>You can access {import.meta.env.VITE_NETWORK === "mainnet" ? "devnet" : "mainnet"} </strong>
          <a
            href={
              import.meta.env.VITE_NETWORK === "mainnet"
                ? "https://devnet.truth.it.com"
                : "https://truth.it.com"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            here
          </a>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">NETWORK SETTINGS</h2>
      <p className="mb-2">
        If you experience connection issues or need to change RPC endpoints, you can set your preferred Solana RPC URL in the <strong>Network Settings</strong> (found in the footer of the app).
      </p>
      <ul className="list-disc list-inside space-y-2 mb-4">
        <li><strong>Default Devnet RPC:</strong> <code>https://api.devnet.solana.com</code></li>
        <li><strong>Default Mainnet RPC:</strong> <code>https://solana-rpc.publicnode.com</code></li>
        <li>
          If these endpoints are not working, you can choose another public Solana RPC provider from:
          <a
            href="https://www.comparenodes.com/library/public-endpoints/solana/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline ml-1"
          >
            CompareNodes Public Solana Endpoints
          </a>
        </li>
        <li>
          For improved reliability and performance, you can also use paid providers such as:
          <ul className="list-disc list-inside ml-6 mt-1">
            <li>
              <a
                href="https://helius.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Helius
              </a>
            </li>
            <li>
              <a
                href="https://quicknode.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                QuickNode
              </a>
            </li>
            <li>
              <a
                href="https://chainstack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Chainstack
              </a>
            </li>
          </ul>
        </li>
      </ul>
      <p>
        If you are unsure how to update your RPC setting, please refer to the footer controls labeled <strong>“Network Settings”</strong>, where you can paste or select a different endpoint.
      </p>
    </div>


  );
}
