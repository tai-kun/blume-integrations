import {
  FAKE_DEFAULT_LOCALE,
  routeByBrowserLanguage,
  typeTableDetailsIds,
} from "@tai-kun/blume-integrations";
import { defineConfig } from "blume";
import { filesystem, githubReleases } from "blume/sources";

const PROJET_NAME = "tai-kun's Blume Integrations";
const GITHUB_REPO = "blume-integrations";
const GITHUB_OWNER = "tai-kun";

export default defineConfig({
  integrations: [routeByBrowserLanguage(), typeTableDetailsIds()],

  content: {
    sources: [
      filesystem({
        root: "content",
      }),
      githubReleases({
        prefix: "changelog",
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
      }),
    ],
  },

  title: PROJET_NAME,
  description: `Documentation for ${PROJET_NAME}`,
  deployment: {
    site: `https://${GITHUB_OWNER}.github.io`,
    base: `/${GITHUB_REPO}`,
  },
  navigation: {
    repo: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    tabs: [
      {
        path: "/",
        label: {
          en: "Documents",
          ja: "ドキュメント",
        },
      },
      {
        path: "/changelog",
        label: {
          en: "Changelog",
          ja: "変更履歴",
        },
      },
    ],
  },
  i18n: {
    locales: [
      { code: "ja", label: "日本語" },
      { code: "en", label: "English" },
      FAKE_DEFAULT_LOCALE,
    ],
  },
});
