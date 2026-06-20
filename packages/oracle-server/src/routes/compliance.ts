import { Router } from "express";
import { callContract } from "../services/sentinelContract.js";

const router = Router();

router.post("/check", async (req, res) => {
  try {
    const { agentDid, proposedAction, requestId, timestamp } = req.body;

    if (!agentDid || !proposedAction || !requestId) {
      return res.status(400).json({ error: "Missing required fields: agentDid, proposedAction, requestId" });
    }

    const result = await callContract("evaluate-compliance", {
      agentDid,
      action: {
        type: proposedAction.type,
        resource: proposedAction.resource,
        amount: proposedAction.amount,
        currency: proposedAction.currency,
        metadata: proposedAction.metadata ?? {},
      },
      requestId,
      timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Compliance] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
