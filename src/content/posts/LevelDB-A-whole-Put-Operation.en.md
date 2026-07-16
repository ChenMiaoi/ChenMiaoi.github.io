---
slug: LevelDB-A-whole-Put-Operation.en
title: 'LevelDB: A whole Put Operation'
published: 2024-09-16
tags:
  - leveldb
  - put
category: leveldb
series: leveldb
lang: "en"
---
I recently got into the field of distributed storage and computing, so I wanted to take LevelDB as my first learning project. At first, I studied through the Feishu document [Hardcore Classroom: LevelDB Source Code Analysis](https://hardcore.feishu.cn/mindnotes/bmncnzpUmXNQruVGOwRwisHyxoh), but I'm personally not quite used to some of the learning order in that document, so I plan to go through the details of the entire LevelDB source code module by module.

The first module is the `DB::Put` operation.
