import { Facebook, Instagram, Linkedin, Mail, Phone, Smartphone } from "lucide-react";

// Site footer, same content as the myfyxx.com footer (policies, contact,
// socials, app, legal lines) in the Fyxx Friday look: burgundy, cream text,
// cream logo. Links to myfyxx.com open in a new tab so the shopper keeps their
// place here. No links to Shopify collections.
const SHOP = "https://www.myfyxx.com";

const POLICIES = [
  { label: "Privacy policy", href: `${SHOP}/policies/privacy-policy` },
  { label: "Return policy", href: `${SHOP}/policies/refund-policy` },
  { label: "Delivery policy", href: `${SHOP}/policies/shipping-policy` },
  { label: "Terms of service", href: `${SHOP}/policies/terms-of-service` },
  { label: "My account", href: `${SHOP}/account` },
];

const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/myfyxx.jo", Icon: Facebook },
  { label: "Instagram", href: "https://www.instagram.com/myfyxx/", Icon: Instagram },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/fyxx/", Icon: Linkedin },
];

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SiteFooter() {
  return (
    <footer id="footer" className="bg-ff-burgundy text-ff-cream">
      <div className="mx-auto max-w-[1320px] px-6 pt-12 pb-28 md:px-10 md:pb-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:gap-8">
          {/* Brand + app */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <img
              src="/brand/fyxx-friday-logo-cream.svg"
              alt="Fyxx Friday"
              width={2587}
              height={1446}
              loading="lazy"
              className="h-14 w-auto"
            />
            <p className="ff-subline mt-4 max-w-[26ch] text-sm text-ff-cream/85">
              A shop that curates, simplifies and delivers. Wine, spirits and cigars in Amman.
            </p>
            <a
              href="https://onelink.to/myfyxx"
              {...ext}
              className="ff-subline mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ff-red px-5 text-sm text-ff-cream transition-colors hover:bg-ff-cream hover:text-ff-burgundy"
            >
              <Smartphone className="h-4 w-4" />
              Get the Fyxx app
            </a>
          </div>

          {/* Policies */}
          <nav aria-label="Policies" className="text-center md:text-left">
            <h2 className="ff-headline text-sm tracking-wide text-ff-red uppercase">
              General policies
            </h2>
            <ul className="ff-small mt-4 space-y-3 text-sm">
              {POLICIES.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...ext}
                    className="text-ff-cream/90 transition-colors hover:text-ff-red"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="text-center md:text-left">
            <h2 className="ff-headline text-sm tracking-wide text-ff-red uppercase">
              Get in touch
            </h2>
            <ul className="ff-small mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="tel:+962791111332"
                  className="inline-flex items-center gap-2 text-ff-cream/90 transition-colors hover:text-ff-red"
                >
                  <Phone className="h-4 w-4" />
                  079 111 1332
                </a>
              </li>
              <li>
                <a
                  href={`${SHOP}/pages/contact-us`}
                  {...ext}
                  className="inline-flex items-center gap-2 text-ff-cream/90 transition-colors hover:text-ff-red"
                >
                  <Mail className="h-4 w-4" />
                  Send us a message
                </a>
              </li>
            </ul>
          </div>

          {/* Socials */}
          <div className="text-center md:text-left">
            <h2 className="ff-headline text-sm tracking-wide text-ff-red uppercase">Follow us</h2>
            <div className="mt-4 flex justify-center gap-3 md:justify-start">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  {...ext}
                  aria-label={label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-ff-cream/40 text-ff-cream transition-colors hover:border-ff-red hover:bg-ff-red"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="ff-small mt-12 border-t border-ff-cream/15 pt-6 text-center text-xs leading-relaxed text-ff-cream/70">
          <p className="text-ff-cream/85">
            © 2026 Fyxx
          </p>
          <p className="mt-2">
            Fyxx &amp; The Green Room are registered brands of Al Kasra for Trade &amp; Marketing
            L.L.C. · Swefieh Village, Ground Floor, Amman, Jordan
          </p>
        </div>
      </div>
    </footer>
  );
}
