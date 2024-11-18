# Latex documentation files
These tex files are copied from the Overleaf project maintained by [Pierre-Leo Bourbonnais](https://github.com/kaligrafy), found here: https://www.overleaf.com/read/dtxfhttxgjrx#d70683.

At the moment, the files on Overleaf are considered the primary version, and if they are updated in Overleaf, the changes should be manually copied and pasted to the files in this repo, then commited and pushed. Eventually, we will move them entirely to the Transition repo and add a script to compile them into a pdf.

When adding or modifying information on these files, they must follow the already present row structure:
```
\label{label}
\makecell[r]{Title} & \[Symbol\] & \[Unit\] & \[Expression\] & Description \\
\hline
```
Each row is starts with a label that allows for it to be located by the tooltip component and ends with `\hline`. Each cell is separated with `&`, and starts and ends with a space. The unit and expression can be empty, in which case they must be represented by a single hyphen (`-`). The symbol, unit, and expression are mathematical expressions, and must be start `\[` and end with `\]`, unless they are empty. Finally, any change must be translated and added to both the French and English file.