// Website Builder Type Definitions

// ============================================
// BRAND
// ============================================
export interface BrandConfig {
    brandName: string;
    headerTitle: string;
    phone: string;
    email: string;
    logoUrl: string;
    faviconUrl: string;
    updatedAt?: any;
}

// ============================================
// THEME
// ============================================
export interface ThemeConfig {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontStyle: "modern" | "elegant" | "minimal";
    buttonRadius: number; // in pixels
    cardShadow: boolean;
    backgroundColor?: string;
    updatedAt?: any;
}

// ============================================
// HOME PAGE
// ============================================
export interface HeroSlide {
    id: string;
    imageUrl: string;
    heading: string;
    subheading: string;
    primaryButtonText: string;
    primaryButtonLink: string;
    secondaryButtonText: string;
    secondaryButtonLink: string;
    order: number;
}

export interface Service {
    id: string;
    title: string;
    description: string;
    iconUrl: string;
    order: number;
}

export interface WhyChooseUsItem {
    id: string;
    title: string;
    description: string;
    order: number;
}

export interface AboutPreviewSection {
    title: string;
    description: string;
    imageUrl: string;
}

export interface CTASection {
    heading: string;
    subheading: string;
    buttonText: string;
    buttonLink: string;
}

export interface CustomContentSection {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    order: number;
}

export interface HomeSectionConfig {
    id: string;       // "hero"|"services"|"about"|"portfolio"|"testimonials"|"whyChooseUs"|"cta"|"customSections"|"contact"
    label: string;    // Human-readable label
    enabled: boolean; // Toggle on/off
    order: number;    // Sort position
}

export interface HomePageContent {
    heroSlides: HeroSlide[];
    aboutPreview: AboutPreviewSection;
    services: Service[];
    whyChooseUs: WhyChooseUsItem[];
    cta: CTASection;
    customSections?: CustomContentSection[];
    sectionLayout?: HomeSectionConfig[];
    updatedAt?: any;
}

// ============================================
// PORTFOLIO PAGE
// ============================================
export interface PortfolioProject {
    id: string;
    title: string;
    category: "residential" | "commercial";
    description: string;
    beforeImageUrl: string;
    afterImageUrl: string;
    imageStyle?: "single" | "before_after";
    location: string;
    showOnHomepage?: boolean;
    order: number;
    createdAt?: any;
}

// ============================================
// TESTIMONIALS PAGE
// ============================================
export interface Testimonial {
    id: string;
    clientName: string;
    clientTitle: string;
    location?: string;
    clientImageUrl: string;
    reviewText: string;
    rating: 1 | 2 | 3 | 4 | 5;
    showOnHomepage?: boolean;
    order: number;
    createdAt?: any;
}

// ============================================
// ABOUT US PAGE
// ============================================
export interface TeamMember {
    id: string;
    name: string;
    role: string;
    bio: string;
    imageUrl: string;
    linkedinUrl?: string;
    instagramUrl?: string;
    showOnHomepage?: boolean;
    order: number;
    createdAt?: any;
}

export interface AboutUsContent {
    mainHeading: string;
    companyStory: string;
    vision: string;
    mission: string;
    founderName: string;
    founderRole: string; // Added
    founderDescription: string; // Added
    founderImageUrl: string;
    founderLinkedinUrl?: string; // Added
    founderInstagramUrl?: string; // Added
    yearsExperience: number;
    projectsCompleted: number;
    partners?: TeamMember[]; // Added for partners section
    updatedAt?: any;
}

// ============================================
// CONTACT PAGE
// ============================================
export interface ContactPageContent {
    address: string;
    googleMapEmbedLink: string;
    whatsappNumber: string;
    instagramUrl: string;
    facebookUrl: string;
    officeHours: string;
    updatedAt?: any;
}

// ============================================
// CUSTOM PAGES
// ============================================
export interface CustomPage {
    id: string;
    title: string;
    slug: string;
    heading: string;
    description: string;
    imageUrl: string;
    showInNav: boolean;
    isPublished: boolean;
    order: number;
    createdAt?: any;
    updatedAt?: any;
}

// ============================================
// COMPLETE WEBSITE DATA
// ============================================
export interface WebsiteData {
    brand: BrandConfig;
    theme: ThemeConfig;
    pages: {
        home: HomePageContent;
        portfolio: PortfolioProject[];
        testimonials: Testimonial[];
        about: AboutUsContent;
        contact: ContactPageContent;
    };
}
