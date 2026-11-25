import { Router } from "express";
import platformAPIClient from "../services/platformAPIClient";

export default function mountUserEndpoints(router: Router) {
  router.post("/signin", async (req, res) => {
    const auth = req.body?.authResult;
    const userCollection = req.app.locals.userCollection;

    if (!userCollection) {
      return res.status(503).json({
        error: "service_unavailable",
        message: "Database not ready",
      });
    }

    if (
      !auth ||
      typeof auth.accessToken !== "string" ||
      !auth.accessToken.trim()
    ) {
      return res.status(400).json({
        error: "invalid_auth",
        message: "Missing Pi access token",
      });
    }

    try {
      const me = await platformAPIClient.get("/v2/me", {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      const piUser = me.data;

      if (
        !piUser ||
        typeof piUser.uid !== "string" ||
        typeof piUser.username !== "string"
      ) {
        return res.status(401).json({
          error: "invalid_pi_user",
          message: "Invalid Pi user response",
        });
      }

      if (auth.user?.uid && auth.user.uid !== piUser.uid) {
        return res.status(401).json({
          error: "identity_mismatch",
          message: "Pi user identity mismatch",
        });
      }

      const roles = Array.isArray(piUser.roles)
        ? piUser.roles
        : [];

      let currentUser = await userCollection.findOne({
        uid: piUser.uid,
      });

      if (currentUser) {
        await userCollection.updateOne(
          { _id: currentUser._id },
          {
            $set: {
              username: piUser.username,
              roles,
            },
            $unset: {
              accessToken: "",
            },
          }
        );

        currentUser = await userCollection.findOne({
          uid: piUser.uid,
        });
      } else {
        const insertResult = await userCollection.insertOne({
          username: piUser.username,
          uid: piUser.uid,
          roles,
        });

        currentUser = await userCollection.findOne({
          _id: insertResult.insertedId,
        });
      }

      if (!currentUser) {
        return res.status(500).json({
          error: "user_storage_failed",
          message: "Could not load user",
        });
      }

      req.session.currentUser = currentUser;

      return res.status(200).json({
        message: "User signed in",
        user: {
          uid: currentUser.uid,
          username: currentUser.username,
          roles: currentUser.roles,
        },
      });
    } catch (err) {
      console.error(
        "Error verifying Pi authentication:",
        err instanceof Error ? err.message : "Unknown error"
      );

      return res.status(401).json({
        error: "invalid_token",
        message: "Pi authentication verification failed",
      });
    }
  });

  router.get("/signout", async (req, res) => {
    req.session.currentUser = null;

    return res.status(200).json({
      message: "User signed out",
    });
  });
}
