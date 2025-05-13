import os
from dotenv import load_dotenv
from web3 import Web3, exceptions

# Load environment variables (.env file must contain PRIVATE_KEY)
load_dotenv()

# Connect to Sepolia Ethereum Testnet
infura_url = "https://sepolia.infura.io/v3/3484dfe927774cd9a6935aea46e565d8"
private_key = os.getenv("PRIVATE_KEY")

# Your MetaMask accounts
from_account = "0xDD08697Ab34579Af08CC5bE01c1E28453F47E55A"
to_account = "0x72Aeb0C895EfAf6ecC077506a96A4145460c45Db"

# WETH Contract Address on Sepolia
weth_contract_address = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9"

# Connect to Web3
web3 = Web3(Web3.HTTPProvider(infura_url))

# Ensure checksum addresses
from_account = web3.to_checksum_address(from_account)
to_account = web3.to_checksum_address(to_account)
weth_contract_address = web3.to_checksum_address(weth_contract_address)

# WETH Contract ABI (essential functions only)
WETH_ABI = [
    {"inputs":[{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"src","type":"address"},{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]

# Instantiate contract
weth_contract = web3.eth.contract(address=weth_contract_address, abi=WETH_ABI)

# Check if you have WETH balance
balance = weth_contract.functions.balanceOf(from_account).call()
print(f"Current WETH balance: {web3.from_wei(balance, 'ether')} WETH")

# If balance too low, deposit Sepolia ETH to get WETH first
if balance < web3.to_wei(0.01, 'ether'):
    nonce = web3.eth.get_transaction_count(from_account)
    deposit_tx = {
        "from": from_account,
        "to": weth_contract_address,
        "value": web3.to_wei(0.01, 'ether'),  # Deposit 0.01 ETH
        "gas": 100000,
        "gasPrice": web3.to_wei("70", "gwei"),
        "nonce": nonce
    }
    signed_deposit = web3.eth.account.sign_transaction(deposit_tx, private_key)
    deposit_tx_hash = web3.eth.send_raw_transaction(signed_deposit.raw_transaction)
    print(" Deposit transaction hash: ", web3.to_hex(deposit_tx_hash))
    print(" Please wait until this deposit transaction is confirmed before transferring!")
else:
    # If enough WETH, proceed with transfer
    nonce = web3.eth.get_transaction_count(from_account)
    amount = web3.to_wei(0.001, 'ether')  # Transfer 0.001 WETH
    transfer_tx = weth_contract.functions.transfer(to_account, amount).build_transaction({
        "chainId": 11155111,
        "gas": 100000,
        "gasPrice": web3.to_wei("70", "gwei"),
        "nonce": nonce,
        "from": from_account
    })
    signed_transfer = web3.eth.account.sign_transaction(transfer_tx, private_key)
    transfer_tx_hash = web3.eth.send_raw_transaction(signed_transfer.raw_transaction)
    print(" WETH Transfer transaction hash: ", web3.to_hex(transfer_tx_hash))