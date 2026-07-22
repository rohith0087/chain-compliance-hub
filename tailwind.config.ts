import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
				display: ['Archivo', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
				serif: ['"Instrument Serif"', 'Georgia', 'serif'],
				mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
			},
			// ── Type scale (the design-system "default") ────────────────────────
			// One compact, data-dense scale for the whole buyer + supplier app.
			// Semantic keys (text-h1, text-body, text-caption…) so intent — not a
			// raw pixel value — is what appears in markup; these replace the ~25
			// ad-hoc text-[Npx] sizes as pages are converted. Line-height + tracking
			// are baked in; weight stays a separate utility (font-semibold/-bold) so
			// it composes predictably. Headings inherit Archivo via the global
			// h1/h2/h3 rule in index.css; use font-display to opt a non-heading in.
			fontSize: {
				display: ['2rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }],   // 32
				h1: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],       // 24
				h2: ['1.25rem', { lineHeight: '1.28', letterSpacing: '-0.01em' }],      // 20
				h3: ['1rem', { lineHeight: '1.4', letterSpacing: '-0.005em' }],         // 16
				body: ['0.875rem', { lineHeight: '1.55' }],                             // 14
				small: ['0.8125rem', { lineHeight: '1.5' }],                            // 13
				caption: ['0.75rem', { lineHeight: '1.4' }],                            // 12
				micro: ['0.6875rem', { lineHeight: '1.35', letterSpacing: '0.01em' }],  // 11
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					foreground: 'hsl(var(--danger-foreground))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					elevated: 'hsl(var(--surface-elevated))'
				},
				// Strategic accent colors
				'blue-accent': 'hsl(var(--blue-accent))',
				'steel-accent': 'hsl(var(--steel-accent))',
				'green-accent': 'hsl(var(--green-accent))',
				'orange-accent': 'hsl(var(--orange-accent))',
				'teal-accent': 'hsl(var(--teal-accent))',
				'pink-accent': 'hsl(var(--pink-accent))',
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// Named radii scale (the design-system "default"): rounded, softly
				// lifted surfaces. card 16 · control 12 · pill full.
				card: '16px',
				control: '12px',
				pill: '9999px',
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-subtle': 'var(--gradient-subtle)',
				'gradient-glass': 'var(--gradient-glass)',
				'gradient-card': 'var(--gradient-card)',
			},
			boxShadow: {
				'elegant': 'var(--shadow-elegant)',
				'subtle': 'var(--shadow-subtle)',
				'glass': 'var(--shadow-glass)',
				'modern': 'var(--shadow-modern)',
				// Named elevation scale (the design-system "default"): a 3-step
				// "lifted" set. e1 rests, e2 is the standard card, e3 is the one
				// panel the user acts on. Warm ink so cards lift off paper / ink
				// without going grey. Consumed via shadow-e1 / -e2 / -e3.
				'e1': 'var(--elevation-1)',
				'e2': 'var(--elevation-2)',
				'e3': 'var(--elevation-3)',
			},
			spacing: {
				'xs': 'var(--spacing-xs)',
				'sm': 'var(--spacing-sm)',
				'md': 'var(--spacing-md)',
				'lg': 'var(--spacing-lg)',
				'xl': 'var(--spacing-xl)',
				'2xl': 'var(--spacing-2xl)',
			},
			backdropBlur: {
				'glass': '16px',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 20px hsl(var(--primary) / 0.3)' },
					'50%': { boxShadow: '0 0 40px hsl(var(--primary) / 0.6)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-in',
				'slide-up': 'slide-up 0.4s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
