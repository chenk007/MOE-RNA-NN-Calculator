# 2′-MOE Oligonucleotide Stability Calculator

Parameter version: **17 September 2026**.

This static website predicts nearest-neighbor thermodynamic parameters for RNA/RNA, RNA/DNA, fully 2′-MOE-modified RNA/RNA (RRHD), partially 2′-MOE-modified RNA/RNA (ALT), and mixed gapmer duplexes under non-crowding and cell-like conditions.

## Public sequence notation

- `Ae` = 2′-MOE-A
- `Ce` = 2′-MOE-C
- `Ge` = 2′-MOE-G
- `Ue` = 2′-MOE-U
- `dA`, `dC`, `dG`, `dT` = DNA
- `A`, `C`, `G`, `U` = RNA

The internal H/J/K/L notation is retained only for parameter lookup.

## Interface

The classic layout includes English, Chinese, Japanese, and Korean. It provides both single-sequence and batch calculation modes. Batch input can be pasted directly from Excel or CSV.

## Parameter source

The RRHD and ALT 2′-MOE-specific nearest-neighbor parameters in this calculator are from the present work. The current parameter file is based on `8种NN parameter260917.xlsx`.


2026-10-23 update: UI/layout, original multilingual experience retained from MOE_NN_Calculator_260918.zip. Updated ten thermodynamic parameter sets, including MOE–DNA junctions; default all-PS linkage count L−1 for Strand A, with per-linkage ΔG37-only corrections. ΔH/ΔS remain PO estimates. Batch PS controls included.

Latest parameter refresh (2026-10-23): The ALT_dilute and ALT_PEG enthalpy, entropy, and Gibbs free energy parameter values have been updated from 10种NN parameter PS backbone 261023_2.xlsx; UI, all other NN parameter sets, and PS correction rules are preserved.

Initiation fix (2026-10-23): ALT dilute/PEG initiation values are synchronized exactly to the corresponding RRHD entries in the latest spreadsheet. Any MOE-containing duplex chooses RRHD initiation explicitly, including mixed Gapmers.


### RNA/DNA lookup fix (2026-10-23)
Corrected the mixed-gapmer DNA/DNA nearest-neighbor lookup to use RNA/DNA keys prefixed `r` (e.g. `rCU/dAG`), matching both dilution and PEG database sets. The input syntax, NN values, initiation correction, PS handling and UI are unchanged.

### PS ΔH°/ΔS° thermodynamic correction update (2026-10-23)
Replaced the former empirical **ΔG°37-only** linkage correction with enthalpy/entropy empirical linkage corrections, fitted through the origin with nPS = 9, 11, 12. Source: `10种NN parameter PS backbone 261023_3.xlsx`. The four coefficient pairs (δH kcal mol⁻¹/linkage; δS cal mol⁻¹ K⁻¹/linkage) are:

| Strand A type | Dilute δH | Dilute δS | PEG δH | PEG δS |
| --- | ---: | ---: | ---: | ---: |
| Contains DNA (RNA–PS–DNA duplex) | 0.26715046 | 0.28394891 | 0.15288548 | 0.23579634 |
| All RNA/MOE (RNA–PS–RNA duplex) | 0.39289125 | 0.52450686 | 0.20243432 | 0.21129577 |

For `n` PS linkages, add `n·δH` and `n·δS` to the existing parameter totals, and add `n·(δH - 310.15·δS/1000)` to ΔG°37. This **replaces** the old ΔG-only correction (no double counting). Corrected totals are displayed in single and batch modes. Any small mismatch between final total ΔG°37 and ΔH°−TΔS°/1000 can originate from rounding or internal differences in non-PS source NN parameters, not the PS correction. These are **empirical per-linkage factors, not sequence-resolved PS NN parameters**. Auto type selection retains the earlier simplified rule: DNA-containing Strand A uses the DNA-type factor across all PS linkages.
