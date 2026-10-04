[English](../README.md) · [简体中文](README.zh-CN.md) · **日本語**

<img align="right" src="../public/avatar.jpg" width="112" alt="Chen Miao のアバター" />

# こんにちは、Chen Miao です

**オペレーティングシステム · カーネル · ドライバ · 低レイヤ開発**

OS や低レイヤのアーキテクチャに惹かれるプログラマです。ハードウェアに近いところでコードを書くのが好きで、普段は C/C++、Rust、Linux を使っています。性能や信頼性、そしてソフトウェアとハードウェアの境界にある細部に関心があります。

**Let me drive your world.**

[ブログ](https://nyachen.cn/) · [GitHub](https://github.com/ChenMiaoi) · [知乎](https://www.zhihu.com/people/Pigeon/posts) · [メール](mailto:chenmiao.ku@gmail.com)

## 関心のある分野

- **Linux とオペレーティングシステム**：起動処理、メモリ管理、ファイルシステム、デバイスドライバ。具体的な処理の流れを追いながら、サブシステム同士がどう連携するのかを学んでいます。
- **コンピュータアーキテクチャとハードウェア設計**：RISC-V、CPU マイクロアーキテクチャ、Verilog、Chisel、Bluespec SystemVerilog。命令やパイプラインが実際のハードウェア記述にどうつながるのかを探っています。
- **システムプログラミングとツールチェーン**：C/C++、Rust、カーネルのビルド、低レイヤのデバッグ。実際のシステムでコードがどう動くのか、その実装にどのような制約があるのかに関心があります。

## 技術ノート

[Miao's Blog](https://nyachen.cn/) には、ソースコードを読み、学び、試したことをまとめています。現象から実装までをたどり、どの処理経路やデータ構造が関わり、なぜその設計になっているのかを書き残したいと考えています。

取り組んでいるテーマは、次の記事から知っていただけます。記事の本文は中国語です。

- [Linux はどう起動するのか：電源投入から init プロセスまで](https://nyachen.cn/2026/07/22/linux-beginner-boot-overview/)：ハードウェア、カーネル、ユーザー空間へと処理が引き継がれる流れをたどります。
- [VFS の 6 つの主要オブジェクト](https://nyachen.cn/2026/08/26/linux-modern-vfs-six-core-objects/)：オブジェクト間の関係から、Linux のファイルシステムに共通する抽象化を読み解きます。
- [RISC-V のハードウェア記述言語：Verilog、Chisel、Bluespec SystemVerilog](https://nyachen.cn/2026/07/22/riscv-hardware-languages-overview/)：ハードウェアの記述方法ごとの特徴と、学び方を整理します。

ほかの記事は [アーカイブ](https://nyachen.cn/archive/) と [テーマ別シリーズ](https://nyachen.cn/series/) にまとめています。

## オープンソースでの活動

Linux カーネルでは、次のような変更に取り組んできました。

- **OpenRISC**：[text patching API](https://github.com/torvalds/linux/commit/4735037b5d9)、[カーネルモジュールの PC 相対リロケーション](https://github.com/torvalds/linux/commit/9d0cb6d00be)、[jump label](https://github.com/torvalds/linux/commit/8c30b0018f9) のサポートを追加。
- **Rust for Linux / kbuild**：[mrproper による libpin_init_internal のクリーンアップ](https://github.com/torvalds/linux/commit/a44bfed9df8)を修正。

コミット、パッチの議論、そのほかのオープンソース活動は [コントリビューションの記録](https://nyachen.cn/contribution/) にまとめています。

## 連絡先

カーネルを読んでいる方、ドライバを書いている方、ソフトウェアとハードウェアの境界に興味がある方、ぜひお話ししましょう。記事の誤りの指摘や、異なる視点からの意見も歓迎します。

- **メール**：[chenmiao.ku@gmail.com](mailto:chenmiao.ku@gmail.com)
- **GitHub**：[@ChenMiaoi](https://github.com/ChenMiaoi)
- **知乎**：[記事一覧](https://www.zhihu.com/people/Pigeon/posts)

---

このリポジトリにはブログのソースコードを置いています。開発、記事の執筆、デプロイの手順は [メンテナンスガイド](development.md)（中国語）をご覧ください。
