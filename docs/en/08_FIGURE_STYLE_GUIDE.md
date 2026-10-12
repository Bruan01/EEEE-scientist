# 08 Figure Style Guide: Figure and Plot Style

This page defines the default DeepScientist figure language for experiment summaries, analysis campaigns, and paper-facing plots.

## Core rule

Prefer restrained, evidence-first figures.

- connector milestone charts should be quick to read
- paper figures should be clean enough to survive PDF export and review
- both should use the fixed Morandi palette family from the prompt / stage skills

## Fixed Morandi palette

- `mist-stone`: `#F3EEE8`, `#D8D1C7`, `#8A9199`
- `sage-clay`: `#E7E1D6`, `#B7A99A`, `#7F8F84`
- `dust-rose`: `#F2E9E6`, `#D8C3BC`, `#B88C8C`
- `fog-blue`: `#DCE5E8`, `#A9BCC4`, `#6F8894`
- `olive-paper`: `#E6E1D3`, `#B8B095`, `#7C7A5C`
- `lavender-ash`: `#E8E3EA`, `#B9AFC2`, `#7D7486`

Recommended use:

- main method vs baseline: `sage-clay` + `mist-stone`
- ablations: `mist-stone` + `fog-blue` + `dust-rose`
- uncertainty / sensitivity: `mist-stone` + `olive-paper`
- appendix / supplementary: `mist-stone` + `lavender-ash`

## Chart selection

Choose chart type by the research question:

- line chart: trends over epochs, steps, budget, scaling, or ordered settings
- bar chart: a small number of categorical comparisons with a common zero baseline
- dot / point-range chart: comparisons where confidence intervals matter
- box / violin / histogram: real distribution questions only
- heatmap: only when matrix structure is genuinely the result

Do not use a crowded dashboard-style layout for one simple claim.

## Color semantics

- ordered magnitude -> sequential muted palette
- signed delta around zero or a reference -> diverging muted palette with a neutral midpoint
- categories -> discrete palette only

Avoid rainbow / jet / HSV-like colormaps.

## Export rules

- connector milestone chart: usually `png`
- paper figure: `pdf` or `svg` plus one `png` preview
- avoid rasterizing line art or text when vector export is possible
- keep white or near-white background
- keep grids light
- keep legends compact or use direct labeling when clearer
- ensure text remains readable after likely journal scaling
- prefer paper-like sizes inspired by common journal layouts:
  - single-column: about `89 mm` wide
  - double-column: about `183 mm` wide

## Mandatory review workflow

Do not mark a meaningful figure as final immediately after rendering it.

For milestone charts, paper figures, and appendix figures:

1. render the first version
2. inspect the actual exported figure
3. fix spacing, labels, legend placement, visual hierarchy, or color choices if needed
4. re-export the final version

Treat “rendered and visually checked” as the minimum completion condition.

## Minimal review checklist

Before treating a figure as done, verify:

- the visual encoding matches the research question
- labels, units, and baselines are explicit
- colors mean the same thing across related figures
- the source data path is known
- the generating script path is known
- the figure can be regenerated from durable files
- the figure stays readable after realistic down-scaling
- the main message is obvious within a quick scan
- the legend does not block the data

## Reference basis

This policy was aligned with:

- PLOS Computational Biology, “Ten Simple Rules for Better Figures”: `https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003833`
- Graphics Principles: `https://graphicsprinciples.github.io/`
- Nature author formatting guidance: `https://www.nature.com/nature/for-authors/formatting-guide`
- Matplotlib colormap guidance: `https://matplotlib.org/stable/users/explain/colors/colormaps.html`
- Datawrapper accessibility guidance: `https://academy.datawrapper.de/article/206-how-we-make-sure-our-charts-maps-and-tables-are-accessible`
