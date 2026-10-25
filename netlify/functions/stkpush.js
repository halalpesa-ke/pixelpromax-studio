exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" })
    };
  }

  try {
    const {
      DARAJA_CONSUMER_KEY,
      DARAJA_CONSUMER_SECRET,
      DARAJA_SHORTCODE,
      DARAJA_PASSKEY,
      DARAJA_CALLBACK_URL,
      DARAJA_ENV
    } = process.env;

    if (
      !DARAJA_CONSUMER_KEY ||
      !DARAJA_CONSUMER_SECRET ||
      !DARAJA_SHORTCODE ||
      !DARAJA_PASSKEY ||
      !DARAJA_CALLBACK_URL
    ) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "M-Pesa configuration is incomplete."
        })
      };
    }

    const { phone, amount } = JSON.parse(event.body || "{}");

    if (
      !/^2547\d{8}$/.test(String(phone)) &&
      !/^2541\d{8}$/.test(String(phone))
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Enter a valid Kenyan phone number beginning with 254."
        })
      };
    }

    const paymentAmount = Number(amount);

    if (
      !Number.isSafeInteger(paymentAmount) ||
      paymentAmount < 1
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Enter a valid payment amount in KSh."
        })
      };
    }

    const baseUrl =
      DARAJA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const credentials = Buffer.from(
      `${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          message: "Could not authenticate with Daraja."
        })
      };
    }

    const date = new Date();

    const timestamp = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .format(date)
      .replace(/\D/g, "");

    const password = Buffer.from(
      `${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkResponse = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: DARAJA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: paymentAmount,
          PartyA: String(phone),
          PartyB: DARAJA_SHORTCODE,
          PhoneNumber: String(phone),
          CallBackURL: DARAJA_CALLBACK_URL,
          AccountReference: "PixelProMax",
          TransactionDesc: "PixelProMax Studio Payment"
        })
      }
    );

    const stkData = await stkResponse.json();

    return {
      statusCode: stkResponse.ok ? 200 : 502,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stkData)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Payment request failed. Please try again."
      })
    };
  }
};
