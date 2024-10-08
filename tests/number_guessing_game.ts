import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GuessingGame } from "../target/types/guessing_game";
import { SystemProgram } from "@solana/web3.js";
import assert from "assert";

describe("guessing_game", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.GuessingGame as Program<GuessingGame>;

  // Define a seconda player account (PDA)
  const player2 = anchor.web3.Keypair.generate();

  // Define the game account (PDA)
  const game = anchor.web3.Keypair.generate();

  // Set the initial random number
  const randomNumber = Math.floor(Math.random() * 100);

  const feeInSol = 100;

  before(async () => {
    // Ensure the provider has enough funds before tests
    const fee = anchor.web3.LAMPORTS_PER_SOL * feeInSol; // 0.01 SOL
    const playerBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    const player2Balance = await provider.connection.getBalance(player2.publicKey);
    if (playerBalance < fee) {
      console.log("Not enough funds for player, funding...");
      await provider.connection.requestAirdrop(provider.wallet.publicKey, 200 * anchor.web3.LAMPORTS_PER_SOL); // Airdrop some SOL
    }
    if (player2Balance < fee) {
      console.log("Not enough funds for player 2, funding...");
      await provider.connection.requestAirdrop(player2.publicKey, 200 * anchor.web3.LAMPORTS_PER_SOL); // Airdrop some SOL
    }
  });

  it("Initializes the game", async () => {
    // Initialize the game with a random number
    await program.methods
      .initialize(new anchor.BN(randomNumber))
      .accounts({
        signer: provider.wallet.publicKey,
        game: game.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([game])
      .rpc();

    const gameAccount = await program.account.game.fetch(game.publicKey);
    assert.equal(gameAccount.randomNumber, randomNumber);
    assert.equal(gameAccount.pot.toNumber(), 0);

    console.log("Game initialized successfully. Random number set:", randomNumber);
  });

  it("Player 1 makes a guess", async () => {
    // Define the player's guess
    const playerGuess = randomNumber > 50 ? randomNumber - 1 : randomNumber + 1; // Purposely incorrect guess

    // The player pays 0.01 SOL to make the guess
    const fee = anchor.web3.LAMPORTS_PER_SOL * feeInSol; // 0.01 SOL

    // Check the player's balance before the guess
    const playerBalanceBefore = await provider.connection.getBalance(provider.wallet.publicKey);
    console.log("Player 1 balance before guess:", playerBalanceBefore);

    // The player makes a guess
    await program.methods
      .guess(playerGuess)
      .accounts({
        player: provider.wallet.publicKey,
        game: game.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch the updated game account
    const gameAccount = await program.account.game.fetch(game.publicKey);

    // The pot should have increased by the fee
    assert.equal(gameAccount.pot.toNumber(), fee);

    console.log("Player 1 made a guess:", playerGuess);
    const playerBalanceAfter = await provider.connection.getBalance(provider.wallet.publicKey);
    console.log("Player 1 balance after guess:", playerBalanceAfter);
    console.log("Updated pot:", gameAccount.pot.toNumber());
  });

  it("Player 2 makes a guess", async () => {
    // Define the player's guess
    const playerGuess = randomNumber > 50 ? randomNumber - 2 : randomNumber + 2; // Purposely incorrect guess

    // The player pays 0.01 SOL to make the guess
    const fee = anchor.web3.LAMPORTS_PER_SOL * feeInSol; // 0.01 SOL

    // Check the player's balance before the guess
    const playerBalanceBefore = await provider.connection.getBalance(player2.publicKey);
    console.log("Player 2 balance before guess:", playerBalanceBefore);

    // The player makes a guess
    await program.methods
      .guess(playerGuess)
      .accounts({
        player: player2.publicKey,
        game: game.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player2])
      .rpc();

    // Fetch the updated game account
    const gameAccount = await program.account.game.fetch(game.publicKey);

    // The pot should have increased by the fee
    assert.equal(gameAccount.pot.toNumber(), fee*2);

    console.log("Player 2 made a guess:", playerGuess);
    const playerBalanceAfter = await provider.connection.getBalance(player2.publicKey);
    console.log("Player 2 balance after guess:", playerBalanceAfter);
    console.log("Updated pot:", gameAccount.pot.toNumber());
  });

  it("Player 2 guesses the correct number", async () => {
    // The player guesses the correct number this time
    const correctGuess = randomNumber;

    // The player makes the correct guess
    await program.methods
      .guess(correctGuess)
      .accounts({
        player: player2.publicKey,
        game: game.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player2])
      .rpc();

    // Fetch the updated game account
    const gameAccount = await program.account.game.fetch(game.publicKey);

    // The pot should be 0 after the correct guess
    assert.equal(gameAccount.pot.toNumber(), 0);
    const playerBalanceAfter = await provider.connection.getBalance(player2.publicKey);
    console.log("Player balance after win:", playerBalanceAfter);
    console.log("Player guessed the correct number:", correctGuess);
    console.log("Pot reset to:", gameAccount.pot.toNumber());
  });
});
