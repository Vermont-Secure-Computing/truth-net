import React from "react";

const SecurityPolicy = () => (
  <div className="max-w-4xl mx-auto p-6 text-gray-800">
    <h1 className="text-2xl font-bold mb-4 text-center">Truth Network - Security Policy</h1>
    <p className="mb-4">
      This document outlines the security measures taken to ensure the integrity and safety of our smart contract on the Solana blockchain.
    </p>

    <h2 className="text-xl font-semibold mt-6">1. Deployment & Immutability</h2>
    <ul className="list-disc list-inside">
      <li>Contract deployed with the <code>--final</code> flag.</li>
      <li>Upgrade authority has been set to <code>null</code>.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">2. Input & Access Validation</h2>
    <ul className="list-disc list-inside">
      <li>All instructions validate required signers using Anchor.</li>
      <li>Time-based phases (commit, reveal) validated with <code>Clock::get()</code>.</li>
      <li>Custom <code>require!</code> error checks used throughout.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">3. Arithmetic Safety</h2>
    <ul className="list-disc list-inside">
      <li>All critical math uses <code>checked_add</code> and <code>saturating_sub</code>.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">4. Rent Management</h2>
    <ul className="list-disc list-inside">
      <li>All temporary accounts are closed using Anchor's <code>close =</code> directive.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">5. Reward Distribution</h2>
    <ul className="list-disc list-inside">
      <li>Snapshot reward logic prevents abuse.</li>
      <li>Final claimer logic ensures full vault drain.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">6. Vulnerability Disclosure</h2>
    <p>If you find a vulnerability, please report it confidentially:</p>
    <ul className="list-disc list-inside">
      <li>Email: <a href="mailto:office@vtscc.org" className="text-blue-600 hover:underline">office@vtscc.org</a></li>
      <li>Secure contact: <a href="https://vtscc.org/contact.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vtscc.org/contact.html</a></li>
    </ul>

    <h2 className="text-xl font-semibold mt-6">7. On-chain Metadata</h2>
    <p>Security metadata embedded in contract via <code>solana-security-txt</code>.</p>

    <h2 className="text-xl font-semibold mt-6">8. Source</h2>
    <ul className="list-disc list-inside">
      <li><a href="https://github.com/Vermont-Secure-Computing/truth-net" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
    </ul>
  </div>
);

export default SecurityPolicy;
