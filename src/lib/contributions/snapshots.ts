import activityData from "../../data/contribution-activity.json" with {
	type: "json",
};
import detailsData from "../../data/contribution-details.json" with {
	type: "json",
};
import { activitySchema, detailsSchema } from "./schema.ts";

// Only sync scripts contact GitHub. All page builds consume these validated files.
export const contributionActivity = activitySchema.parse(activityData);
export const contributionDetails = detailsSchema.parse(detailsData);
