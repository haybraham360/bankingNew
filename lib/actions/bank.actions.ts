"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";

import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";

import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank, getLoggedInUser, getTransactionByAccountId } from "./user.actions";

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    // get banks from db
    const banks = await getBanks({ userId });

    const accounts = await Promise.all(
      banks?.map(async (bank: Bank) => {
        // get each account info from plaid
        const accountsResponse = await plaidClient.accountsGet({
          access_token: bank.accessToken,
        });
        const accountData = accountsResponse.data.accounts[0];

        // get institution info from plaid
        const institution = await getInstitution({
          institutionId: accountsResponse.data.item.institution_id!,
        });

        const account = {
          id: accountData.account_id,
          availableBalance: accountData.balances.available!,
          currentBalance: accountData.balances.current!,
          institutionId: institution.institution_id,
          name: accountData.name,
          officialName: accountData.official_name,
          mask: accountData.mask!,
          type: accountData.type as string,
          subtype: accountData.subtype! as string,
          appwriteItemId: bank.$id,
          sharaebleId: bank.shareableId,
        };

        return account;
      })
    );

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce((total, account) => {
      return total + account.currentBalance;
    }, 0);

    return parseStringify({ data: accounts, totalBanks, totalCurrentBalance });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {

  
  try {
    // get bank from db
    const bank = await getBank({ documentId: appwriteItemId });

    // get account info from plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: bank.accessToken,
    });
    const accountData = accountsResponse.data.accounts[0];

    // get transfer transactions from appwrite
    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    
    const transferTransactions = transferTransactionsData.documents.map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: transferData.amount!,
        date: transferData.$createdAt,
        paymentChannel: transferData.channel,
        category: transferData.category,
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
      })
    );

    // get institution info from plaid
    const institution = await getInstitution({
      institutionId: accountsResponse.data.item.institution_id!,
    });

    const transactions = await getTransactions({
      accessToken: bank?.accessToken,
    });


    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type as string,
      subtype: accountData.subtype! as string,
      appwriteItemId: bank.$id,
    };

    // sort transactions by date such that the most recent transaction is first
      const allTransactions = [...transactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
  }
};

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    const intitution = institutionResponse.data.institution;

    return parseStringify(intitution);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get transactions
// export const getTransactions = async ({
//   accessToken,
// }: getTransactionsProps) => {
//   let hasMore = true;
//   let transactions: any = [];
  
//   console.log(`Fetching transactions for access token: ${accessToken}`);
//   try {
//     // Iterate through each page of new transaction updates for item
//     while (hasMore) {
//       const response = await plaidClient.transactionsSync({
//         access_token: accessToken,
//       });
      
//       const data = response.data;

//       transactions = response.data.added.map((transaction) => ({
//         id: transaction.transaction_id,
//         name: transaction.name,
//         paymentChannel: transaction.payment_channel,
//         type: transaction.payment_channel,
//         accountId: transaction.account_id,
//         amount: transaction.amount,
//         pending: transaction.pending,
//         category: transaction.category ? transaction.category[0] : "",
//         date: transaction.date,
//         image: transaction.logo_url,
//       }));

//       hasMore = data.has_more;
//     }

//     return parseStringify(transactions);
//   } catch (error) {
//     console.error("An error occurred while getting the accounts:", error);
//   }
// };

const mockTransactions = [
  {
    transaction_id: "674e8cf90018eaa45706",
    name: "Coffee Shop",
    payment_channel: "in_store",
    account_id: "674e8aae003b2e6a02e3",
    amount: 5.75,
    pending: false,
    category: "Transfer",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/4/45/A_small_cup_of_coffee.JPG",
  },
  {
    transaction_id: "674e8cf90018eaa45707",
    name: "Grocery Store",
    payment_channel: "in_store",
    account_id: "674e8c8c00294a52598f",
    amount: 45.32,
    pending: false,
    category: ["Shopping", "Groceries"],
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/1/18/Grocery_store_shelves.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45708",
    name: "Online Subscription",
    payment_channel: "online",
    account_id: "674e8aae003b2e6a02e3",
    amount: 9.99,
    pending: true,
    category: "Services",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Streaming_media_apps.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45709",
    name: "Restaurant",
    payment_channel: "in_store",
    account_id: "674e8c8c00294a52598f",
    amount: 25.89,
    pending: false,
    category: "Food",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/d/d8/Dining_out.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45710",
    name: "Movie Tickets",
    payment_channel: "online",
    account_id: "674e8aae003b2e6a02e3",
    amount: 15.00,
    pending: false,
    category: "Entertainment",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/7/74/Movie_ticket.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45711",
    name: "Gas Station",
    payment_channel: "in_store",
    account_id: "674e8c8c00294a52598f",
    amount: 35.76,
    pending: true,
    category: "Transportation",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Gas_station.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45712",
    name: "Gym Membership",
    payment_channel: "online",
    account_id: "674e8aae003b2e6a02e3",
    amount: 49.99,
    pending: false,
    category: "Fitness",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Gym.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45713",
    name: "Bookstore",
    payment_channel: "in_store",
    account_id: "674e8c8c00294a52598f",
    amount: 12.45,
    pending: false,
    category: "Shopping",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Bookstore_shelves.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45714",
    name: "Ride Share",
    payment_channel: "online",
    account_id: "674e8aae003b2e6a02e3",
    amount: 18.67,
    pending: true,
    category: "Transportation",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Ride_sharing.jpg",
  },
  {
    transaction_id: "674e8cf90018eaa45715",
    name: "Pharmacy",
    payment_channel: "in_store",
    account_id: "674e8c8c00294a52598f",
    amount: 8.99,
    pending: false,
    category: "Health",
    date: "2024-12-01",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Pharmacy_shelves.jpg",
  },
];

export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  console.log(`Using mock data for access token: ${accessToken}`);
  const user = await getLoggedInUser();

  try {
    // Get transactions from Appwrite
    const appwriteTransactions = await getTransactionByAccountId({ accountId: user.$id });

    // Transform Appwrite transactions to match the mock transaction format
    const transformedAppwriteTransactions = appwriteTransactions.map((transaction) => ({
      id: transaction.$id,
      name: transaction.name,
      paymentChannel: transaction.channel,
      type: transaction.category,
      accountId: transaction.senderBankId,
      amount: transaction.amount,
      pending: false, // You might want to add a pending field to your Appwrite schema
      category: transaction.category,
      date: transaction.$createdAt,
      image: '', // Add an image URL if available in your schema
    }));

    // Combine mock transactions with Appwrite transactions
    const transactions = [
      ...mockTransactions.map((transaction) => ({
        id: transaction.transaction_id,
        name: transaction.name,
        paymentChannel: transaction.payment_channel,
        type: transaction.payment_channel,
        accountId: transaction.account_id,
        amount: transaction.amount,
        pending: transaction.pending,
        category: Array.isArray(transaction.category)
          ? transaction.category[0]
          : transaction.category,
        date: transaction.date,
        image: transaction.logo_url,
      })),
      ...transformedAppwriteTransactions
    ];

    return parseStringify(transactions);
  } catch (error) {
    console.error("An error occurred while getting the transactions:", error);
    return null;
  }
};




