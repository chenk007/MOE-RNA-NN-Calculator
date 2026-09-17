# MOE NN Calculator

**Parameter version: 17 September 2026.**

Static web calculator for RNA/RNA, RNA/DNA, RRHD-MOE/RNA, ALT-MOE/RNA, and mixed gapmer duplexes.

## Online notation

- `Ae` = 2′-MOE-A
- `Ce` = 2′-MOE-C
- `Ge` = 2′-MOE-G
- `Ue` = 2′-MOE-U
- `dA`, `dC`, `dG`, `dT` = DNA residues
- `A`, `C`, `G`, `U` = RNA residues

Legacy H/J/K/L notation is also accepted internally:

- H = Ae
- J = Ce
- K = Ge
- L = Ue

## Parameter sets

The 2′-MOE-specific RRHD and ALT nearest-neighbor parameters in this version were determined in the present work.


- RRHD: one strand is fully 2′-MOE modified and hybridized with RNA.
- ALT: one strand contains partial/intermittent 2′-MOE modifications and is hybridized with RNA.
- DNA/RNA: DNA strand hybridized with RNA.
- RNA/RNA: unmodified RNA duplex.
- Gapmer: terminal MOE wings and central DNA gap. MOE/MOE regions are calculated using RRHD parameters, DNA/RNA regions using DNA/RNA hybrid parameters, and MOE-DNA junctions using ALT-based approximation.

## Conditions

Non-crowding condition: 100 mM NaCl, 10 mM Na2HPO4 (pH 7.0 at 37 °C), 1 mM Na2EDTA.

Cell-like condition: 40 wt% PEG200, 100 mM NaCl, 10 mM Na2HPO4 (pH 7.0 at 37 °C), 1 mM Na2EDTA.

## Limitation

The current version is parameterized for phosphodiester (P=O) backbones. Phosphorothioate (P=S) backbones are currently approximated using P=O parameters.


V6.8: Fixed compact DNA parameter-key parsing so internal keys such as dTT do not trigger the single-letter T warning, while user input such as dCGe is still parsed as dC + Ge.


## Batch calculation

The Batch calculation tab accepts pasted Excel/CSV data in any of the following formats:

```text
GeUeGeAeGeCeGe
Seq1	GeUeGeAeGeCeGe
Seq1	GeUeGeAeGeCeGe	CeAeCeUeCeGeCe
```

If Strand B is omitted, the complementary RNA strand is generated automatically. Batch results include ΔH°, ΔS°, ΔG°37, approximation counts, status, and CSV export.

Public 2′-MOE notation: `Ae`, `Ce`, `Ge`, `Ue`.


## Current parameter source

`8种NN parameter260917.xlsx` (17 September 2026). The modified 2′-MOE RRHD/ALT parameter sets are from the present work.
