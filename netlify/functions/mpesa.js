export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed"
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    const body = await req.json();

    const amount = Number(body.amount);
    const phone = String(body.phone || "").trim();
    const service = String(body.service || "").trim();

    if (!amount || amount < 1) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Enter a valid payment amount."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    let formattedPhone = phone.replace(/\s+/g, "");

    if (formattedPhone.startsWith("07")) {
      formattedPhone =
        "254" + formattedPhone.substring(1);
    }

    if (formattedPhone.startsWith("+254")) {
      formattedPhone =
        formattedPhone.substring(1);
    }

    if (!/^2547\d{8}$/.test(formattedPhone)) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Enter a valid Kenyan M-Pesa number, e.g. 0712345678."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const consumerKey =
      process.env.MPESA_CONSUMER_KEY;

    const consumerSecret =
      process.env.MPESA_CONSUMER_SECRET;

    const shortcode =
      process.env.MPESA_SHORTCODE;

    const passkey =
      process.env.MPESA_PASSKEY;

    const callbackUrl =
      process.env.MPESA_CALLBACK_URL;

    if (
      !consumerKey ||
      !consumerSecret ||
      !shortcode ||
      !passkey ||
      !callbackUrl
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "M-Pesa payment system is not configured yet."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const auth =
      Buffer.from(
        consumerKey + ":" + consumerSecret
      ).toString("base64");

    const tokenResponse = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: {
          Authorization: "Basic " + auth
        }
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);

      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Unable to connect to M-Pesa."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const now = new Date();

    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password =
      Buffer.from(
        shortcode +
        passkey +
        timestamp
      ).toString("base64");

    const stkResponse = await fetch(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",

        headers: {
          Authorization:
            "Bearer " +
            tokenData.access_token,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          BusinessShortCode: shortcode,

          Password: password,

          Timestamp: timestamp,

          TransactionType:
            "CustomerPayBillOnline",

          Amount: Math.round(amount),

          PartyA: formattedPhone,

          PartyB: shortcode,

          PhoneNumber: formattedPhone,

          CallBackURL: callbackUrl,

          AccountReference:
            "PixelProMax",

          TransactionDesc:
            service || "PixelProMax Service"
        })
      }
    );

    const stkData =
      await stkResponse.json();

    console.log(
      "STK response:",
      stkData
    );

    if (
      stkData.ResponseCode === "0"
    ) {
      return new Response(
        JSON.stringify({
          success: true,

          message:
            "STK Push sent successfully. Check your phone and enter your M-Pesa PIN.",

          checkoutRequestID:
            stkData.CheckoutRequestID,

          merchantRequestID:
            stkData.MerchantRequestID
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,

        message:
          stkData.ResponseDescription ||
          stkData.errorMessage ||
          "M-Pesa payment request failed."
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {

    console.error(
      "M-Pesa error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        message:
          "Something went wrong while starting the M-Pesa payment."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};

export const config = {
  path: "/api/mpesa"
};
