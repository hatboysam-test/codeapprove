import { Application } from "probot";

import * as config from "./config";

export function bot(app: Application) {
  app.on("check_suite.requested", async (context) => {
    // A new check suite has been created. A check suite is a collection
    // of check runs for a commit. GitHub sends check_suite.requested
    // to all GitHub apps that are installed on each commit.
    //
    // A check run is an individual test that runs as part of a check suite.
    console.log("check_suite.requested", JSON.stringify(context));

    const owner = context.repo().owner;
    const repo = context.repo().repo;
    const number = context.issue().number;

    const checkCreateRes = await context.github.checks.create({
      name: "CodeApprove",
      owner,
      repo,
      head_sha: context.payload.check_suite.head_sha,
      status: "in_progress",
      details_url: `${config.baseUrl()}/pr/${owner}/${repo}/${number}`,
    });

    // TODO: Store this id somewhere for updating
    console.log(
      `Created check run ${checkCreateRes.data.id} in suite ${checkCreateRes.data.check_suite.id}`
    );
  });
}
