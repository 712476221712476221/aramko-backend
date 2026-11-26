import { Router } from "express";
import { ObjectId } from "mongodb";

const categories = [
  "Cars",
  "Heavy Equipment",
  "Spare Parts",
  "Ceramics",
  "Building Materials",
  "Real Estate",
  "Other Products",
];

function validListing(body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const category = body?.category;
  const pricePi = Number(body?.pricePi);
  const description = typeof body?.description === "string"
    ? body.description.trim()
    : "";
  const images = Array.isArray(body?.images) ? body.images : [];

  if (!title || title.length > 150) return null;
  if (!categories.includes(category)) return null;
  if (!Number.isFinite(pricePi) || pricePi <= 0) return null;
  if (description.length > 5000 || images.length > 6) return null;
  if (!images.every((url: any) =>
    typeof url === "string" &&
    url.length <= 2048 &&
    /^https?:\/\/\S+$/i.test(url)
  )) return null;

  return { title, category, pricePi, description, images };
}

export default function mountListingEndpoints(router: Router) {
  router.get("/", async (req, res) => {
    try {
      const collection = req.app.locals.listingCollection;
      if (!collection) return res.status(503).json({ error: "Database not ready" });

      const filter: any = { status: "active" };
      if (typeof req.query.category === "string" &&
          categories.includes(req.query.category)) {
        filter.category = req.query.category;
      }

      const listings = await collection.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return res.json({ listings });
    } catch {
      return res.status(500).json({ error: "Could not load listings" });
    }
  });

  router.post("/", async (req, res) => {
    const user = req.session.currentUser;
    if (!user?.uid) return res.status(401).json({ error: "Sign in required" });

    const data = validListing(req.body);
    if (!data) return res.status(400).json({ error: "Invalid listing details" });

    try {
      const collection = req.app.locals.listingCollection;
      if (!collection) return res.status(503).json({ error: "Database not ready" });

      const listing = {
        ...data,
        sellerUid: user.uid,
        sellerUsername: user.username,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(listing);
      return res.status(201).json({
        listing: { _id: result.insertedId, ...listing },
      });
    } catch {
      return res.status(500).json({ error: "Could not create listing" });
    }
  });

  router.put("/:id", async (req, res) => {
    const user = req.session.currentUser;
    if (!user?.uid) return res.status(401).json({ error: "Sign in required" });
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const data = validListing(req.body);
    if (!data) return res.status(400).json({ error: "Invalid listing details" });

    try {
      const collection = req.app.locals.listingCollection;
      const filter = {
        _id: new ObjectId(req.params.id),
        sellerUid: user.uid,
        status: "active",
      };

      const result = await collection.updateOne(filter, {
        $set: { ...data, updatedAt: new Date() },
      });

      if (!result.matchedCount) {
        return res.status(404).json({ error: "Listing not found or not yours" });
      }

      const listing = await collection.findOne(filter);
      return res.json({ listing });
    } catch {
      return res.status(500).json({ error: "Could not update listing" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const user = req.session.currentUser;
    if (!user?.uid) return res.status(401).json({ error: "Sign in required" });
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    try {
      const collection = req.app.locals.listingCollection;
      const result = await collection.updateOne(
        {
          _id: new ObjectId(req.params.id),
          sellerUid: user.uid,
          status: "active",
        },
        { $set: { status: "inactive", updatedAt: new Date() } }
      );

      if (!result.matchedCount) {
        return res.status(404).json({ error: "Listing not found or not yours" });
      }

      return res.json({ message: "Listing deactivated" });
    } catch {
      return res.status(500).json({ error: "Could not deactivate listing" });
    }
  });
}
