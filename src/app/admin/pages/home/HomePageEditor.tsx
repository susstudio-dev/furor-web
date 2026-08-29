'use client';

import { useState } from 'react';
import type { Pages, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { saveSiteContent } from '@/lib/admin-save';
import { SeoFields } from '@/components/admin/SeoFields';
import { ImageUploader } from '@/components/admin/ImageUploader';

type HomePage = Pages['home'];

export function HomePageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patchHome(patch: Partial<HomePage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, home: { ...prev.pages.home, ...patch } },
    }));
    setDirty(true);
  }

  type Board = HomePage['board'];
  type BoardKey = keyof Board;

  function patchBoard(patch: Partial<Board>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: { ...prev.pages.home, board: { ...prev.pages.home.board, ...patch } },
      },
    }));
    setDirty(true);
  }

  function patchCountIn(i: number, patch: { count?: string; title?: string; body?: string }) {
    patchBoard({
      countIn: c.pages.home.board.countIn.map((item, j) => (j === i ? { ...item, ...patch } : item)),
    });
  }

  function patchFinder(patch: Partial<HomePage['styleFinder']>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: {
          ...prev.pages.home,
          styleFinder: { ...prev.pages.home.styleFinder, ...patch },
        },
      },
    }));
    setDirty(true);
  }

  function patchRumba(patch: Partial<HomePage['rumba']>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: { ...prev.pages.home, rumba: { ...prev.pages.home.rumba, ...patch } },
      },
    }));
    setDirty(true);
  }

  const h = c.pages.home;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <SeoFields
          pageKey="home"
          value={{ seoTitle: h.seoTitle, seoDescription: h.seoDescription }}
          onChange={(next) => patchHome(next)}
          titleHint="Leave empty and we build it from your two lead dance styles. The site name is added after either way."
        />
        <Section title="Booking board (the card over the hero)">
          <p className="-mt-1 text-xs text-cream/50">
            The first thing a visitor sees. Words in <code>{'{braces}'}</code> are filled in from
            live batch data — <code>{'{price}'}</code> is the first-class fee, <code>{'{date}'}</code> the
            start date, <code>{'{n}'}</code> a count. Never type a rupee amount by hand: it would
            be wrong the day you change a deposit.
          </p>
          <Field label="Speed line" hint="The small grey line to the right of the “Booking open” badge.">
            <input
              value={h.board.speed}
              onChange={(e) => patchBoard({ speed: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline">
              <input
                value={h.board.headline}
                onChange={(e) => patchBoard({ headline: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Headline — highlighted tail" hint="Shown in the accent colour.">
              <input
                value={h.board.headlineAccent}
                onChange={(e) => patchBoard({ headlineAccent: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Lead — when a first-class price is known" hint="Use {price}.">
            <textarea
              rows={2}
              value={h.board.leadWithPrice}
              onChange={(e) => patchBoard({ leadWithPrice: e.target.value })}
              className="input"
            />
          </Field>
          <Field
            label="Lead — when no batch has a price yet"
            hint="Shown instead of the line above when there is nothing bookable."
          >
            <textarea
              rows={2}
              value={h.board.leadNoPrice}
              onChange={(e) => patchBoard({ leadNoPrice: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Note on beginner cards"
              hint="Shows on every Foundation card; loudest on the spotlit one."
            >
              <input
                value={h.board.spotlitNote}
                onChange={(e) => patchBoard({ spotlitNote: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Note on a higher-level card">
              <input
                value={h.board.higherLevelNote}
                onChange={(e) => patchBoard({ higherLevelNote: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Start date line" hint="Use {date}.">
              <input
                value={h.board.startsTemplate}
                onChange={(e) => patchBoard({ startsTemplate: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="First class price line" hint="Use {price}.">
              <input
                value={h.board.trialPrice}
                onChange={(e) => patchBoard({ trialPrice: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Full-program line" hint="Use {price}.">
              <input
                value={h.board.fullProgram}
                onChange={(e) => patchBoard({ fullProgram: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Seats left — exactly one" hint="Use {n}. Kept separate so it never reads “1 seats”.">
              <input
                value={h.board.seatsLeftOne}
                onChange={(e) => patchBoard({ seatsLeftOne: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Seats left — more than one" hint="Use {n}.">
              <input
                value={h.board.seatsLeftMany}
                onChange={(e) => patchBoard({ seatsLeftMany: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-cream/10 bg-ink-950/40 p-4 grid gap-3">
            <p className="text-xs uppercase tracking-widest text-cream/60">
              The count-in strip under the cards
            </p>
            <p className="-mt-1 text-xs text-cream/50">
              The questions a first-timer is actually asking, answered where they decide. One card
              may use <code>{'{price}'}</code>. Do not promise money back — the paid trial is
              non-refundable.
            </p>
            {h.board.countIn.map((item, i) => (
              <div key={i} className="rounded-lg border border-cream/10 bg-ink-900/40 p-3 grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-cream/50">Card {i + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      patchBoard({ countIn: h.board.countIn.filter((_, j) => j !== i) })
                    }
                    className="text-xs text-cream/40 hover:text-ember-400"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
                  <Field label="Count" hint="The big faint number.">
                    <input
                      value={item.count}
                      onChange={(e) => patchCountIn(i, { count: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Title">
                    <input
                      value={item.title}
                      onChange={(e) => patchCountIn(i, { title: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Body">
                  <textarea
                    rows={2}
                    value={item.body}
                    onChange={(e) => patchCountIn(i, { body: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() =>
                  patchBoard({
                    countIn: [
                      ...h.board.countIn,
                      {
                        // Keep the strip counting: the next card takes the next
                        // number, so 5-6-7-8 stays 5-6-7-8-9 rather than
                        // restarting at a blank.
                        count: String(
                          (Number(h.board.countIn[h.board.countIn.length - 1]?.count) || 4) + 1,
                        ),
                        title: '',
                        body: '',
                      },
                    ],
                  })
                }
                className="text-sm text-ember-400 hover:text-ember-300"
              >
                + Add card
              </button>
            </div>
            <Field
              label="Fallback body when no first-class price is known"
              hint="Replaces whichever card uses {price} if there is no bookable batch."
            >
              <textarea
                rows={2}
                value={h.board.countInFallbackBody}
                onChange={(e) => patchBoard({ countInFallbackBody: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <Field label="Resolve line" hint="The right-aligned line that closes the strip.">
            <input
              value={h.board.resolveLine}
              onChange={(e) => patchBoard({ resolveLine: e.target.value })}
              className="input"
            />
          </Field>
          <Field
            label="Testimonial suffix"
            hint="Appended after the student's name. Use {style} for their dance style."
          >
            <input
              value={h.board.proofSuffix}
              onChange={(e) => patchBoard({ proofSuffix: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Style-finder link">
              <input
                value={h.board.styleFinderLink}
                onChange={(e) => patchBoard({ styleFinderLink: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Experienced-dancer link">
              <input
                value={h.board.advancedLink}
                onChange={(e) => patchBoard({ advancedLink: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="All-batches button">
              <input
                value={h.board.allBatchesLink}
                onChange={(e) => patchBoard({ allBatchesLink: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field
            label="WhatsApp message when nothing is bookable"
            hint="What we type into WhatsApp for a visitor when the board is empty."
          >
            <textarea
              rows={2}
              value={h.board.emptyNote}
              onChange={(e) => patchBoard({ emptyNote: e.target.value })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="What we teach (style pill row)">
          <Field label="Eyebrow">
            <input
              value={h.whatWeTeach.eyebrow}
              onChange={(e) =>
                patchHome({ whatWeTeach: { ...h.whatWeTeach, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="La Rumba band (replaces the old batches strip)">
          <p className="-mt-1 text-xs text-cream/50">
            The social as proof: photos, a student&apos;s words, the weekly count. Day, time and
            venue come from the Tonight settings — edit those under Site.
          </p>
          <Field label="Eyebrow">
            <input value={h.rumba.eyebrow} onChange={(e) => patchRumba({ eyebrow: e.target.value })} className="input" />
          </Field>
          <Field label="Headline">
            <input value={h.rumba.headline} onChange={(e) => patchRumba({ headline: e.target.value })} className="input" />
          </Field>
          <Field label="Body">
            <textarea rows={3} value={h.rumba.body} onChange={(e) => patchRumba({ body: e.target.value })} className="input" />
          </Field>
          {h.rumba.photos.map((p, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-cream/50">Photo {i + 1}</p>
                <button
                  type="button"
                  onClick={() => patchRumba({ photos: h.rumba.photos.filter((_, j) => j !== i) })}
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove
                </button>
              </div>
              <ImageUploader
                label="Image"
                value={p.src}
                onChange={(v) => {
                  const next = h.rumba.photos.slice();
                  next[i] = { ...p, src: v };
                  patchRumba({ photos: next });
                }}
                aspect="wide"
              />
              <Field label="Description" hint="Alt text — describe what's happening.">
                <input
                  value={p.alt}
                  onChange={(e) => {
                    const next = h.rumba.photos.slice();
                    next[i] = { ...p, alt: e.target.value };
                    patchRumba({ photos: next });
                  }}
                  className="input"
                />
              </Field>
            </div>
          ))}
          {h.rumba.photos.length < 3 ? (
            <div>
              <button
                type="button"
                onClick={() => patchRumba({ photos: [...h.rumba.photos, { src: '', alt: '' }] })}
                className="text-sm text-ember-400 hover:text-ember-300"
              >
                + Add photo
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Weekly stat line" hint="Use {n} — the students-this-week count from Site settings. Blank hides it.">
              <input value={h.rumba.statTemplate} onChange={(e) => patchRumba({ statTemplate: e.target.value })} className="input" />
            </Field>
            <Field label="RSVP button">
              <input value={h.rumba.rsvpLabel} onChange={(e) => patchRumba({ rsvpLabel: e.target.value })} className="input" />
            </Field>
            <Field label="First-class link" hint="The current first-class price is appended automatically.">
              <input value={h.rumba.classLink} onChange={(e) => patchRumba({ classLink: e.target.value })} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Style finder">
          <p className="-mt-1 text-xs text-cream/50">
            The two-question picker in the middle of the home page. The two track names and their
            descriptions are fixed in code — they decide which batch the finder looks up — but
            everything around them is yours.
          </p>
          <Field label="Eyebrow">
            <input
              value={h.styleFinder.eyebrow}
              onChange={(e) => patchFinder({ eyebrow: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.styleFinder.headline}
              onChange={(e) => patchFinder({ headline: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Lead paragraph">
            <textarea
              rows={3}
              value={h.styleFinder.lead}
              onChange={(e) => patchFinder({ lead: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Question" hint="Shown above the two choices.">
              <input
                value={h.styleFinder.question}
                onChange={(e) => patchFinder({ question: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Reset button">
              <input
                value={h.styleFinder.resetLabel}
                onChange={(e) => patchFinder({ resetLabel: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Result eyebrow" hint="Above the recommended track.">
              <input
                value={h.styleFinder.recommendEyebrow}
                onChange={(e) => patchFinder({ recommendEyebrow: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="“Next beginner batch” heading">
              <input
                value={h.styleFinder.nextBatchLabel}
                onChange={(e) => patchFinder({ nextBatchLabel: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Start date line" hint="Use {date}. The price is shown separately, below.">
            <input
              value={h.styleFinder.startsTemplate}
              onChange={(e) => patchFinder({ startsTemplate: e.target.value })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="How it works">
          <Field label="Eyebrow">
            <input
              value={h.howItWorks.eyebrow}
              onChange={(e) =>
                patchHome({ howItWorks: { ...h.howItWorks, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.howItWorks.headline}
              onChange={(e) =>
                patchHome({ howItWorks: { ...h.howItWorks, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          {h.howItWorks.steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-cream/50">Step {i + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    patchHome({
                      howItWorks: {
                        ...h.howItWorks,
                        steps: h.howItWorks.steps.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove
                </button>
              </div>
              <Field label="Title">
                <input
                  value={s.title}
                  onChange={(e) => {
                    const next = h.howItWorks.steps.slice();
                    next[i] = { ...s, title: e.target.value };
                    patchHome({ howItWorks: { ...h.howItWorks, steps: next } });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Body">
                <textarea
                  rows={2}
                  value={s.body}
                  onChange={(e) => {
                    const next = h.howItWorks.steps.slice();
                    next[i] = { ...s, body: e.target.value };
                    patchHome({ howItWorks: { ...h.howItWorks, steps: next } });
                  }}
                  className="input"
                />
              </Field>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() =>
                patchHome({
                  howItWorks: {
                    ...h.howItWorks,
                    steps: [...h.howItWorks.steps, { title: '', body: '' }],
                  },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add step
            </button>
          </div>
        </Section>

        <Section title="Closing CTA (brand gradient block)">
          <Field label="Headline" hint="Wrap a word in *asterisks* for the accent style — e.g. Ready when *you* are.">
            <input
              value={h.closingCta.headline}
              onChange={(e) =>
                patchHome({ closingCta: { ...h.closingCta, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={h.closingCta.body}
              onChange={(e) =>
                patchHome({ closingCta: { ...h.closingCta, body: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Visit us section">
          <p className="-mt-1 text-xs text-cream/50">
            The studio cards near the bottom of the home page. The address, hours, parking note,
            phone number and photos all come from each studio's own record under Studios — these
            are the words around them.
          </p>
          <Field label="Eyebrow">
            <input
              value={h.visitUs.eyebrow}
              onChange={(e) => patchHome({ visitUs: { ...h.visitUs, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="Headline template"
            hint='Use {neighborhood} — replaced with the studio neighbourhood, e.g. "Find us in {neighborhood}, Hyderabad."'
          >
            <input
              value={h.visitUs.headlineTemplate}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, headlineTemplate: e.target.value } })
              }
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="“Address” heading">
              <input
                value={h.visitUs.addressLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, addressLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“Hours” heading">
              <input
                value={h.visitUs.hoursLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, hoursLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“Parking” heading">
              <input
                value={h.visitUs.parkingLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, parkingLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“What we teach here” heading">
              <input
                value={h.visitUs.teachHereLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, teachHereLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
          </div>
          <Field label="Call button" hint="Use {phone} — filled from the studio's own number.">
            <input
              value={h.visitUs.callTemplate}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, callTemplate: e.target.value } })
              }
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Map frame title" hint="Read aloud by screen readers. Use {studio}.">
              <input
                value={h.visitUs.mapTitle}
                onChange={(e) => patchHome({ visitUs: { ...h.visitUs, mapTitle: e.target.value } })}
                className="input"
              />
            </Field>
            <Field label="Studio photo description" hint="Image alt text. Use {studio}.">
              <input
                value={h.visitUs.photoAlt}
                onChange={(e) => patchHome({ visitUs: { ...h.visitUs, photoAlt: e.target.value } })}
                className="input"
              />
            </Field>
          </div>
          <Field label="“Why Furor” eyebrow" hint="The small label above the three-point block.">
            <input
              value={h.whyFurorEyebrow}
              onChange={(e) => patchHome({ whyFurorEyebrow: e.target.value })}
              className="input"
            />
          </Field>
        </Section>
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">{title}</p>
      {children}
    </div>
  );
}
