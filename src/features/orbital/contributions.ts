import { contributionDetails } from "../../lib/contributions/snapshots";
import { prepareContributionDetails } from "../../utils/contribution-reader";

export function GET() {
	return Response.json(prepareContributionDetails(contributionDetails));
}
