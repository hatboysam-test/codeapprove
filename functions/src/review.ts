import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import * as githubAuth from "./githubAuth";

import { Review, ReviewStatus, Thread, ReviewState } from "../../shared/types";
import {
  reviewStatesEqual,
  getReviewComment,
  calculateReviewStatus,
} from "../../shared/typeUtils";
import { reviewPath, threadsPath } from "../../shared/database";
import { docRef, collectionRef } from "./databaseUtil";

export const onReviewWrite = functions.firestore
  .document("orgs/{org}/repos/{repo}/reviews/{reviewId}")
  .onWrite(async (change, ctx) => {
    console.log(`onReviewWrite: ${JSON.stringify(ctx.params)}`);
    if (!change.after.exists) {
      console.log("Ignoring review deletion.");
      return;
    }

    const { org, repo } = ctx.params;

    const before = change.before.exists
      ? (change.before.data() as Review)
      : undefined;
    const after = change.after.data() as Review;

    // TODO(stop): This function goes in a loop!
    // Check for a change in review state and recalculate status
    let newStatus: ReviewStatus | undefined = undefined;
    if (!reviewStatesEqual(before?.state, after?.state)) {
      await admin.firestore().runTransaction(async (t) => {
        const ref = change.after.ref;
        const review = (await t.get(ref)).data() as Review;
        const reviewStatus = review.state.status;

        // When a review is closed, we don't do anything
        // TODO(stop): Probably should do this outside the transaction!
        if (review.state.closed) {
          newStatus = reviewStatus;
        } else {
          newStatus = calculateReviewStatus(review.state);
        }

        console.log(
          `Setting review state.status from ${reviewStatus} to ${newStatus}`
        );
        await t.update(ref, "state.status", newStatus);
      });

      if (!newStatus) {
        console.log(`newStatus === undefined`);
        return;
      }

      // Update the GitHub review when one of:
      // 1) The top-level status is changing
      // 2) There is a new comment
      const statusChanged = newStatus !== after.state.status;
      if (statusChanged) {
        console.log(`status changed: ${after.state.status} --> ${newStatus}}`);
      }
      const hasNewComment =
        before && before.state.last_comment < after.state.last_comment;
      if (hasNewComment) {
        const oldTime = new Date(before!.state.last_comment).toISOString();
        const newTime = new Date(after.state.last_comment).toISOString();
        console.log(`new comment: ${oldTime} --> ${newTime}`);
      }

      if (statusChanged || hasNewComment) {
        // Authorize as the Github App
        const gh = await githubAuth.getAuthorizedRepoGithub(org, repo);

        // Add a review and a comment
        const reviewEvent =
          newStatus === ReviewStatus.APPROVED ? "APPROVE" : "REQUEST_CHANGES";

        const state: ReviewState = {
          ...after.state,
          status: newStatus,
        };

        const threadsRef = collectionRef<Thread>(
          admin.firestore(),
          threadsPath({
            owner: org,
            repo: repo,
            number: after.metadata.number,
          })
        );
        const threads = (await threadsRef.get()).docs.map((d) => d.data());

        const body = getReviewComment(after.metadata, state, threads);
        await gh.reviewPullRequest(
          org,
          repo,
          after.metadata.number,
          reviewEvent,
          body
        );
      }
    }
  });

export const onThreadWrite = functions.firestore
  .document("orgs/{org}/repos/{repo}/reviews/{reviewId}/threads/{threadId}")
  .onWrite(async (change, ctx) => {
    console.log(`onThreadWrite: ${JSON.stringify(ctx.params)}`);
    if (!change.after.exists) {
      console.log("Ignoring thread deletion.");
      return;
    }

    const { org, repo, reviewId, threadId } = ctx.params;

    const before = change.before.exists
      ? (change.before.data() as Thread)
      : undefined;
    const after = change.after.data() as Thread;

    if (after.draft) {
      console.log(`Ignoring draft thread ${after.id}`);
    }

    // TODO(stop): If side=left and base is not latest or side=right and head is not latest, run updateThread

    if (before?.resolved !== after.resolved) {
      // Bump the Review unresolved count up/down
      const diff = after.resolved ? -1 : 1;

      // This will trigger the thread onWrite function
      console.log(`Incrementing state.unresolved by ${diff}`);
      const reviewRef = docRef<Review>(
        admin.firestore(),
        reviewPath({ owner: org, repo: repo, number: reviewId })
      );
      await reviewRef.update(
        "state.unresolved",
        admin.firestore.FieldValue.increment(diff)
      );
    }
  });
