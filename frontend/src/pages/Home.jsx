import CategoriesSection from "../components/home/CategoriesSection";
import { AlertTriangle, RefreshCw } from "lucide-react";
import CtaSection from "../components/home/CtaSection";
import FeaturedProjects from "../components/home/FeaturedProjects";
import HeroSection from "../components/home/HeroSection";
import HowItWorksSection from "../components/home/HowItWorksSection";
import PlansSection from "../components/home/PlansSection";
import WhyUsSection from "../components/home/WhyUsSection";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { useHomeCatalog } from "../hooks/useHomeCatalog";
import { scrollToId } from "../utils/catalog";

const FEATURED_LIMIT = 8;

const HOME_LINKS = [
  { label: "Software", href: "#software" },
  { label: "Categories", href: "#categories" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Plans", href: "#plans" },
  { label: "Why us", href: "#why-us" },
];

const HOME_FOOTER_LINKS = [
  { label: "Software", to: "/projects" },
  { label: "Pricing", to: "/pricing" },
  { label: "How it works", href: "#how-it-works" },
  { label: "User support", href: "#why-us" },
];

function Home() {
  const catalog = useHomeCatalog();

  const showError = Boolean(catalog.error);
  const showCategories = catalog.categories.length > 0;
  const showFeatured =
    catalog.loading || catalog.projects.length > 0 || showError;

  const handleSearch = (value) => {
    catalog.search(value);
    scrollToId("projects");
  };

  const handleSelectCategory = (category) => {
    catalog.selectCategory(category);
    scrollToId("projects");
  };

  const featuredProjects = catalog.filtered.slice(0, FEATURED_LIMIT);

  return (
    <main className="home-page">
      <Header links={HOME_LINKS} />

      <HeroSection
        onSearch={handleSearch}
        counts={catalog.counts}
      />

      {showError && (
        <div className="container">
          <div className="error-state" role="alert">
            <span className="error-state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
            <h3>We couldn't load the catalog</h3>
            <p>Please check your connection and try again.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      )}

      {showCategories && (
        <CategoriesSection
          categories={catalog.categories}
          counts={catalog.counts}
          active={catalog.activeCategory}
          onSelect={handleSelectCategory}
        />
      )}

      {showFeatured && (
        <FeaturedProjects
          projects={featuredProjects}
          total={catalog.filtered.length}
          loading={catalog.loading}
          query={catalog.query}
          activeCategory={catalog.activeCategory}
          onClear={catalog.clearFilters}
        />
      )}

      <HowItWorksSection />
      <PlansSection />
      <WhyUsSection />

      <CtaSection onExploreCategories={() => scrollToId("categories")} />
      <Footer links={HOME_FOOTER_LINKS} />
    </main>
  );
}

export default Home;