export const FAMILY = `# my family        <- top comment must survive edits
[meta]
title = "Robles Family"

[people.binh]
name = "Binh"
sex = "M"
birth = 1994
index = true
decorations = ["substance-abuse"]

[people.mai]
name = "Mai" # inline comment
sex = "F"
birth = 1995

[people.kai]
name = "Kai"
sex = "M"
birth = 2021
parents = "binh-mai"

[unions.binh-mai]
partners = ["binh", "mai"]
status = "married"
year = 2020

[emotional.kai-binh]
between = ["kai", "binh"]
kind = "close"

[annotations.note1]
text = "moved to NYC 2018"
attach = "binh"

[layout]
binh = [0, 0]
mai = [160, 0]
kai = [80, 140]
note1 = [0, 40]
`;
