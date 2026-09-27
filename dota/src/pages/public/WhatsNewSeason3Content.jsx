import { Link } from "react-router-dom";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import {
  WhatsNewSectionHead,
  WhatsNewSectionLinks,
  WhatsNewShowcaseCard,
  WhatsNewShowcaseGrid,
  WhatsNewSpotlight,
} from "./whatsNewShared.jsx";

const S3 = "/whats-new/season-3";

const SHOTS = {
  leagueHub: `${S3}/theleague.png`,
  leagueLore: `${S3}/teamlore.png`,
  leaguePastRosters: `${S3}/pastrosters.png`,
  leagueSeasonRosters: `${S3}/seasonsroster.png`,
  profilePublic: `${S3}/publicprofile.png`,
  profileTeam: `${S3}/publicprofileteam.png`,
  profileLeagueStats: `${S3}/leaguestats.png`,
  cardDeck: `${S3}/carddeck.png`,
  versioningPage: `${S3}/whatnewpage.png`,
  versioningChangelog: `${S3}/changelog.png`,
  versioningSite: `${S3}/siteversioning.png`,
};

export function WhatsNewSeason3Content() {
  return (
    <div className="whats-new-page__version-inner whats-new-page__version-inner--visual">
      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-s3-league-title"
      >
        <WhatsNewSectionHead
          kicker="The League"
          titleId="whats-new-s3-league-title"
          title="Franchises, lore & rosters"
          lead={`Permanent franchise pages for ${SITE_BRAND_SHORT} — stories, art, and lineups that carry across seasons.`}
        />

        <WhatsNewShowcaseGrid columns={2}>
          <WhatsNewShowcaseCard
            src={SHOTS.leagueHub}
            alt="The League franchise hub"
            title="Franchise hub"
            text="Search, filter by season, open any organization in one grid."
          />
          <WhatsNewShowcaseCard
            src={SHOTS.leagueLore}
            alt="Franchise lore and gallery"
            title="Lore & gallery"
            text="Taglines, honors, placement history, and art on each franchise page."
          />
          <WhatsNewShowcaseCard
            src={SHOTS.leaguePastRosters}
            alt="Past season rosters"
            title="Past rosters"
            text="Accordion history — who played each campaign on the same franchise."
          />
          <WhatsNewShowcaseCard
            src={SHOTS.leagueSeasonRosters}
            alt="Season roster view"
            title="Live season rosters"
            text="League-wide roster tab tied to the current tournament teams."
          />
        </WhatsNewShowcaseGrid>

        <WhatsNewSectionLinks
          links={[
            { to: "/league", label: "Open The League", primary: true },
            { to: "/league?view=rosters", label: "Season rosters" },
          ]}
        />
      </section>

      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-s3-profile-title"
      >
        <WhatsNewSectionHead
          kicker="Community"
          titleId="whats-new-s3-profile-title"
          title="Public profiles & league stats"
          lead="Shareable player pages with OpenDota sync and BPCL league performance when data is available."
        />

        <WhatsNewShowcaseGrid columns={3}>
          <WhatsNewShowcaseCard
            src={SHOTS.profilePublic}
            alt="Public player profile"
            title="Profile layout"
            text="Card, roles, links, and feed — built for fans and casters."
          />
          <WhatsNewShowcaseCard
            src={SHOTS.profileTeam}
            alt="Team on profile"
            title="Team context"
            text="Franchise and roster affiliation on the public page."
            fit="wide"
          />
          <WhatsNewShowcaseCard
            src={SHOTS.profileLeagueStats}
            alt="League stats on profile"
            title="League stats"
            text="Record, games, and top heroes scoped to league IDs."
            fit="wide"
          />
        </WhatsNewShowcaseGrid>

        <WhatsNewSectionLinks
          links={[
            { to: "/community", label: "Community directory", primary: true },
            { to: "/dashboard", label: "Dashboard" },
          ]}
        />
      </section>

      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-s3-card-deck-title"
      >
        <WhatsNewSectionHead
          kicker="Collectibles"
          titleId="whats-new-s3-card-deck-title"
          title="Past season cards in your deck"
          lead="Each season keeps its own approved art and tier — scroll your deck to show earlier campaigns."
        />

        <WhatsNewSpotlight
          src={SHOTS.cardDeck}
          alt="Card deck with past season cards"
          title="Season-stacked card deck"
          text="On your profile and dashboard, earlier Season 1 and 2 cards sit next to your current-season badge."
          fit="square"
          points={[
            "Art and tier are scoped to the season you earned them in",
            "One scrollable deck — no overwriting old cards when a new season starts",
          ]}
        />

        <WhatsNewSectionLinks
          links={[
            { to: "/dashboard", label: "Your dashboard", primary: true },
            { to: "/community", label: "Browse profiles" },
          ]}
        />
      </section>

      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-s3-versioning-title"
      >
        <WhatsNewSectionHead
          kicker="Transparency"
          titleId="whats-new-s3-versioning-title"
          title="Versions & changelog"
          lead="Major season releases (x.0.0) on this page; patch notes (x.y.z) in the changelog modal."
        />

        <WhatsNewShowcaseGrid columns={2}>
          <WhatsNewShowcaseCard
            src={SHOTS.versioningPage}
            alt="What's New season filter"
            title="Season filter"
            text="Jump to Season 3, 2, or 1 major release pages."
            fit="banner"
            spanFull
          />
          <WhatsNewShowcaseCard
            src={SHOTS.versioningSite}
            alt="Version history"
            title="Version history"
            text="Structured milestones and release dates."
            fit="banner"
            spanFull
          />
          <WhatsNewShowcaseCard
            src={SHOTS.versioningChangelog}
            alt="Changelog modal"
            title="Changelog"
            text="Line-by-line fixes and features between majors."
            fit="standard"
            spanFull
          />
        </WhatsNewShowcaseGrid>

        <p className="whats-new-page__inline-tip">
          <span className="whats-new-page__inline-tip-mark">Tip</span>
          Open <strong>View changelog</strong> in the bar above for patch notes, or{" "}
          <Link to="/whats-new?v=3.0.0" className="whats-new-page__inline-tip-link">
            filter to Season 3
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
