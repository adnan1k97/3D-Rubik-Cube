const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get the balance in wei
  const balance = await ethers.provider.getBalance(deployer.address);
  // Format to ETH
  const balanceInEth = ethers.formatEther(balance);
  console.log("Account balance:", balanceInEth, "ETH");

  if (parseFloat(balanceInEth) < 0.0001) {
    throw new Error("Insufficient funds to deploy the contract!");
  }

  const CubeMaster = await ethers.getContractFactory("CubeMaster");
  const cubeMaster = await CubeMaster.deploy();
  await cubeMaster.waitForDeployment();

  const address = await cubeMaster.getAddress();
  console.log("CubeMaster deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
