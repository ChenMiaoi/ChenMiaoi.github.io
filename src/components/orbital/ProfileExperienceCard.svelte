<script lang="ts">
import { useTranslations } from "../../features/orbital/i18n/context";
import type { ProfileConfig } from "../../types/config";

export let entry: NonNullable<ProfileConfig["affiliations"]>[number];
const { t } = useTranslations();
</script>

<li class="identity-affiliation">
  <div class="identity-affiliation-copy">
    <span class="identity-affiliation-institution">{entry.institution}</span>
    {#if entry.role}<span class="identity-affiliation-role"><span>{entry.role}</span>{#if entry.department || entry.institutionAbbreviation}<span class="identity-affiliation-department">[{entry.department ?? entry.institutionAbbreviation}]</span>{/if}</span>{/if}
  </div>
  <span class="identity-affiliation-period"><time datetime={entry.start}>{entry.start.replace('-', '/')}</time><span aria-hidden="true">—</span>{#if entry.end}<time datetime={entry.end}>{entry.end.replace('-', '/')}</time>{:else}<span class="identity-affiliation-present">{t("至今")}</span>{/if}</span>
</li>
