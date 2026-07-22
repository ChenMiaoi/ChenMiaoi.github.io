---
slug: rfc1951-DEFLATE-Compressed-Data-Format-Specification.en
title: 'rfc1951: DEFLATE Compressed Data Format Specification'
published: 2024-05-10
tags:
  - rfc
  - deflate
category: rfc
series: rfc
lang: "en"
---
## Abstract

This specification defines a lossless compressed data format that compresses data using a combination of the `LZ77` algorithm and Huffman coding, with efficiency comparable to the best general-purpose compression methods currently available. Data can be produced or consumed, even for an arbitrarily long sequentially presented input data stream, using only a limited amount of intermediate storage. The format can be implemented readily in a manner not covered by patents.

## Introduction

### Purpose

The purpose of this specification is to define a lossless compressed data format that:

- Is independent of `CPU` type, operating system, file system, and character set, and hence can be used for interchange;
- **Can compress or decompress a data stream (as opposed to a randomly accessible file) to produce another data stream, using only an a priori bounded amount of intermediate storage, and hence can be used in data communications or similar applications**, such as a `Unix filter`;
- **Compresses data with an efficiency comparable to the best general-purpose compression methods currently available**, and in particular better than the "compress" program;
- **Can be implemented readily in a manner not covered by patents**, and hence can be practiced freely;
- **Is compatible with the file format produced by the currently widely used** `gzip` **utility, in that a conforming decompressor will be able to read data produced by an existing** `gzip` **compressor**.

> Can compress or decompress a data stream:
>> Transforming data into a more compact representation to reduce the space it occupies;  
> 
> Uses only a limited amount of intermediate storage:  
>> In other words, the amount of storage required is determined up front and does not grow with the size of the data stream; **could using a buffer perhaps improve performance somewhat**?  
> 
> Not covered by patents:
>> **This compression format has no associated patent protection**. In other words, using this compression format does not infringe anyone else's patent rights, because the design of the format does not involve any patented technology or method. This means that anyone is free to implement, use, and distribute this compression format without worrying about infringing others' intellectual property.  

The data format defined by this specification does not attempt to:

- Provide random access to compressed data;
- Compress specialized data as well as the best specialized algorithms currently available;

On the above points, it is consistent with the previous specification, `GZIP`. A simple counting argument shows that **no lossless compression algorithm can compress every possible input data set**. For the format defined here, the worst-case expansion is $5$ bytes per $32K$-byte block, i.e., a size increase of $0.015%$ for large data sets. English text usually compresses by a factor of $2.5 \sim 3$; executable files usually compress somewhat less; graphical data such as raster images may compress even more.

### Intended audience

This specification is intended for use by software implementors **to compress data into** the `deflate` **format and/or decompress data from** the `deflate` format.

The text of this specification assumes that the reader has a basic background in programming, at the level of bits and other primitive data representations. Familiarity with the technique of Huffman coding is helpful, but not required.

### Score

This specification defines a method for representing a sequence of bytes as a (usually shorter) sequence of bits, and a method for packing the latter bit sequence into bytes.

### Compliance

Unless otherwise indicated below, **a compliant decompressor must be able to accept and decompress any data set that conforms to all the specifications presented here; a compliant compressor must produce data sets that conform to all the specifications presented here**.

### Definitions of terms and conventions used

`byte`: `8 bit` stored or transmitted as a unit. (For the purposes of this specification, a byte is exactly 8 bits, even on computers that store a byte in a number of bits different from eight.)

`String`: a sequence of arbitrary bytes.

### Changes from previous versions

There have been no technical changes to the `deflate` format since version `1.1` of this specification. In version `1.2`, some terminology was changed. Version `1.3` converted the specification to `RFC` style.

## Compress representation overview

A compressed data set consists of a series of blocks, corresponding to successive blocks of input data. The block sizes are arbitrary, except that non-compressible blocks are limited to $65535$ bytes.

Each block is compressed using a combination of the `LZ77` algorithm and Huffman coding. The Huffman trees of each block are independent of those of the preceding and following blocks; the `LZ77` algorithm may use references to duplicated strings occurring in a previous block, up to $32K$ input bytes back.

Each block consists of two parts: a pair of Huffman code trees that describe the representation of the compressed data part, and a compressed data part. (The Huffman trees themselves are also compressed using Huffman encoding.) The compressed data consists of two types of elements: `literal bytes` (i.e., strings not detected as duplicates within the previous $32K$ input bytes) and pointers to duplicated strings, where a pointer is represented as a $\<length, backward\  distance\>$ pair. The representation used in the `deflate` format limits distances ($distance$) to $32K$ bytes and lengths ($length$) to $258$ bytes, but does not limit the size of a block, except for the non-compressible blocks noted above.

Each type of value in the compressed data (`literal`, `distance`, and `lengths`) is represented using a Huffman code, with one code tree for literals (`literal`) and lengths (`length`), and a separate code tree for distances (`distance`). The code trees for each block appear in a compact form just before the compressed data for that block.

## Detailed specification

### Overall conventions

In the diagrams below, a `box` like this represents one byte:

```text
+---+ 
|   | <-- the vertical bars might be missing 
+---+
```

A `box` like this represents a variable number of bytes:

```text
+==============+ 
|              | 
+==============+
```

**Bytes stored in a computer do not have a "bit order", since they are always treated as a unit**. However, a byte regarded as an integer between $0 \sim 255$ does have a most-significant bit and a least-significant bit, and since we write numbers with the most-significant digit on the left, we also write bytes with the most-significant bit on the left.

In the diagram below, we number the bits of a byte so that bit `0` is the least-significant bit:

```text
+--------+ 
|76543210| 
+--------+
```

Within a computer, a number may occupy multiple bytes. In the format described here, **all multi-byte numbers are stored least-significant byte first** (**i.e., at the lower memory address**).  

```text
    0        1 
+--------+--------+ 
|00001000|00000010| 
+--------+--------+ 
ˆ         ˆ 
|         | 
|         + more significant byte = 2 x 256 
+ less significant byte = 8
```  

#### Packing into bytes

**Since the data format described here is byte-oriented rather than bit-oriented, this document does not address the order in which the bits of a byte are transmitted on a bit-sequential medium**. However, **we will describe the compressed block format below as a sequence of data elements of various bit lengths, rather than a sequence of bytes. We must therefore specify how to pack these data elements into bytes to form the final compressed byte sequence**.

- Data elements are packed into bytes in order of increasing bit number within the byte, i.e., starting with the least-significant bit of the byte.
- Data elements other than Huffman codes are packed starting with the least-significant bit of the data element.
- Huffman codes are packed starting with the most-significant bit of the code.

In other words, if one were to print out the compressed data as a sequence of bytes, starting with the first byte at the right margin and proceeding to the left, with the most-significant bit of each byte on the left as usual, one would be able to parse the result from right to left, with fixed-width elements in the correct most-significant-bit to least-significant-bit order, and Huffman codes in bit-reversed order (i.e., with the first bit of the code in the relative least-significant-bit position).

```text
假设我们有一个字节序列，其中每个字节包含以下数据元素：
- 3位长度（LSB至MSB）
- 2位距离（LSB至MSB）
- 3位文字（LSB至MSB）
现在让我们考虑一个示例字节：10110010。

根据先前的说明，我们从右到左解析：
- 最右侧的位（最低有效位）表示文字的最低位。
- 接下来的2位表示距离。
- 接下来的3位表示长度。
- 最左侧的3位表示文字的最高位。
所以，10110010字节可以解析为：
- 文字：010
- 距离：01
- 长度：100
```

### Compressed block format

#### Synopsis of prefix and Huffman coding

Prefix coding represents symbols from an a priori known alphabet by bit sequences (codes), one code for each symbol, in such a way that different symbols may be represented by bit sequences of different lengths, but a parser can always parse an encoded string unambiguously symbol by symbol.

We **define a prefix code in terms of a binary tree in which the two edges descending from each non-leaf node are labeled** `0` **and** `1`**, and in which the leaf nodes correspond one-to-one with (are labeled by) the symbols of the alphabet; the code of a symbol is then the sequence of** `0` **and** `1` **labels on the edges leading from the root to the leaf labeled with that symbol**. For example:

```text
            /\          Symbol      Code 
           0  1         ------      ----
          /    \            A        00 
         /\     B           B         1 
        0  1                C       011 
       /    \               D       010 
      A     /\ 
           0  1 
          /    \ 
         D      C
```

A parser can decode the next symbol from an encoded input stream by starting at the root and walking down the tree, at each step choosing the edge corresponding to the next input bit.

Given an alphabet with known symbol frequencies, the Huffman algorithm allows the construction of an optimal prefix code (one that represents strings with those symbol frequencies using the fewest bits of any possible prefix code for that alphabet). Such a code is called a Huffman code. (For more information on Huffman codes, see the reference <[Huffman, D. A., “A Method for the Construction of Minimum Redundancy Codes”, Proceedings of the Institute of Radio Engineers, September 1952, Volume 40, Number 9, pp. 1098-1101](https://www.ias.ac.in/article/fulltext/reso/011/02/0091-0099)>)

Note that in the `deflate` format, **the Huffman codes for the various alphabets must not exceed certain maximum code lengths. This constraint complicates the algorithm for computing code lengths from symbol frequencies**. For details, see the reference cited above.
