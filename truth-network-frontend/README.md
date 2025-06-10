# Truth Network Frontend

Frontend for the decentralized voting and truth-verification protocol powered by Solana and Anchor.

> GitHub Repo: [https://github.com/Vermont-Secure-Computing/truth-net](https://github.com/Vermont-Secure-Computing/truth-net)  
> Frontend Path: `truth-network-frontend/`

---

## Requirements

Make sure the following tools are installed on your machine:

- **Node.js** (v18+ recommended)
- **npm** or **yarn**
- **Solana CLI** – [Install Guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI** – [Install Guide](https://book.anchor-lang.com/chapter_2/installation.html)
- **Rust** (`rustup`, `cargo`)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Vermont-Secure-Computing/truth-net.git
cd truth-net/truth-network-frontend
```

---

### 2. Install Dependencies

```bash
npm install
# or
yarn
```

---

### 3. Set Up Environment

This project uses two environment config files:

- `.env.devnet` for Solana **Devnet**
- `.env.mainnet` for Solana **Mainnet**

Vite automatically selects the correct file based on the script you run.

**Example contents of `.env.devnet`:**

```env
VITE_SOLANA_NETWORK=devnet
```

**Example contents of `.env.mainnet`:**

```env
VITE_SOLANA_NETWORK=mainnet
```

Make sure these files exist in the project root.

---

### 4. Start the Development Server

#### For Devnet

```bash
npm run dev:devnet
```

#### For Mainnet

```bash
npm run dev:mainnet
```

Then open your browser at [http://localhost:5173](http://localhost:5173)

---

## Build for Production

#### Build for Devnet

```bash
npm run build:devnet
```

#### Build for Mainnet

```bash
npm run build:mainnet
```

Then preview the production build locally:

```bash
npm run preview
```

---

## Folder Structure

```bash
truth-network-frontend/
├── public/             # Static assets
├── src/                # React source code
│   ├── components/     # UI Components
│   ├── pages/          # Route components
│   ├── constants/      # Solana program IDs, cluster settings
├── .env.devnet
├── .env.mainnet
├── vite.config.js
└── package.json
```

---

## Contributing

Pull requests are welcome! Please open an issue first if you'd like to propose a major change.

---

## License

MIT License © Vermont Secure Computing