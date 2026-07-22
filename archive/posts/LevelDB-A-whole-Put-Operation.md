---
title: 'LevelDB: A whole Put Operation'
slug: LevelDB-A-whole-Put-Operation
published: 2024-09-16
tags:
  - leveldb
  - put
category: leveldb
series: leveldb
---
我在最近接触了分布式存储计算这一个方向，因此想从leveldb作为一个最初的学习项目；起初，我是通过[硬核课堂 LevelDB源码分析](https://hardcore.feishu.cn/mindnotes/bmncnzpUmXNQruVGOwRwisHyxoh)这一飞书文档学习，但是这个文档有些学习顺序我个人不是很习惯，因此打算分模块去将整个LevelDB的整个源码细节。

首先第一个模块，便是`DB::Put`这一操作。
