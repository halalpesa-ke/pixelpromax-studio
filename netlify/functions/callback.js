exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Method not allowed"
      })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const callback = data?.Body?.stkCallback;

    if (!callback) {
      console.error("Invalid M-Pesa callback format");

      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Invalid callback format"
        })
      };
    }

    const result = {
      merchantRequestID: callback.MerchantRequestID,
      checkoutRequestID: callback.CheckoutRequestID,
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc
    };

    if (callback.ResultCode === 0) {
      const items =
        callback.CallbackMetadata?.Item || [];

      const metadata = {};

      for (const item of items) {
        if (item.Name && item.Value !== undefined) {
          metadata[item.Name] = item.Value;
        }
      }

      result.receiptNumber =
        metadata.MpesaReceiptNumber || null;

      result.amount =
        metadata.Amount ?? null;

      result.phoneNumber =
        metadata.PhoneNumber ?? null;

      result.transactionDate =
        metadata.TransactionDate ?? null;
    }

    console.log(
      "M-Pesa callback received:",
      JSON.stringify(result)
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted"
      })
    };
  } catch (error) {
    console.error("Callback processing error:", error.message);

    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Invalid callback data"
      })
    };
  }
};
