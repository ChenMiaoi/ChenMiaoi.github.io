import {
	contributionActivity,
	contributionDetails,
} from "../../lib/contributions/snapshots";
import { prepareContributionDetails } from "../../utils/contribution-reader";

export function GET() {
	return Response.json({
		version: 1,
		activity: contributionActivity,
		...prepareContributionDetails(contributionDetails),
	});
}
