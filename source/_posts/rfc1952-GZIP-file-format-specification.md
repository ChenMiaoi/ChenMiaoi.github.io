---
title: 'rfc1952: GZIP file format specification'
mathjax: true
date: 2024-05-09 18:35:37
tags: [rfc, gzip]
categories: [rfc]
---

# GZIP file format specification version 4.3

---  

## Abstract

本篇规范定义了一种无损压缩数据格式，与广泛使用的`GZIP`实用程序兼容。该格式包括`循环冗余校验值(cyclic redundancy check, CRC)`，用于检测数据损坏。该格式目前使用`DEFLATE`压缩方法，但可以轻松扩展以使用其他压缩方法。该格式可以轻松地以未受专利覆盖的方式实现。

## Introduction

### Purpose

该规范的目的是定义一种无损压缩的数据格式：

- 与`CPU`类型、操作系统、文件系统和字符集相独立；因此可以互换使用；
- **可以压缩或解压缩一个数据流(与此相对的是随机访问介质文件)来产生另一种数据流，只使用预先限定的中间存储量，因此可以用于数据通信或类似结果**，比如`Unix过滤器`；
- **数据的压缩效率可以与当前最佳的通用压缩方法相媲美**，尤其是比"compress"程序更好;
- **可以轻易地以专利不涵盖的方式实行**，因此可以自由实现;
- **与当前广泛使用的**`gzip`**实用程序生成的文件格式兼容，符合标准的解压器能够读取由现有**`gzip`**压缩器生成的数据**。

> 可以压缩或解压缩数据流：
>> 将数据转化为一种更为紧凑的表示形式，以减少其占用空间；  
> 
> 只实用有限量的中间存储空间：  
>> 也就是说，数据的大小在一开始就会被计算，不会随着数据流的大小变化而增长；**使用缓冲区或许能够提升一定的性能**？  
> 
> 专利不涵盖：
>> **该压缩格式没有与之相关的专利保护**。换句话说，使用该压缩格式不会侵犯其他人的专利权利，因为该格式的设计没有涉及到受专利保护的技术或方法。这意味着任何人都可以自由地实现、使用和分发这种压缩格式，而不必担心侵犯他人的知识产权。  

本规范定义的数据格式不会做出以下尝试：

- 提供对压缩数据的随机访问;
- 压缩专用数据以及目前最好的专用算法;

### Intended audience

本规范供软件实现者使用，**用于将数据压缩为**`gzip`**格式和(或)从**`gzip`格式中解压数据。

本规范的文本假定读者具有编程方面的基础知识，能够理解位和其他基本数据表示级别的概念。

### Scope

本规范指定了一种压缩方法和一个文件格式(**后者仅假定文件可以存储在任意字节序列**)。它没有指定与文件系统的任何特定接口，也没有涉及字符集或编码的任何内容(除了文件名和注释，这些都是可选的)。

### Compliance

除非下文另有说明，**符合规范的解压器必须能够接收并解压符合此处提供的所有规范的任何文件；符合规范的压缩器必须生成符合此处提供的所有规范的文件**。附录中的材料不属于规范本身，与符合性无关。

### Definitions of terms and conventions used 

`byte`: 以单位形式存储或传输的`8 bit`。(对于此规范，一个字节恰好是8位，即使在将字节存储在与8位不同的位数的计算机也是如此。)

### Changes from previous versions

自本规范的`4.1`版本起，未对`gzip`格式进行任何技术变更。在`4.2`版本中，更改了一些术语，并重写了示例`CRC`代码，以提高清晰度并消除调用者进行前置和后置条件的要求。`4.3`版本是将规范转为`RFC`风格的过程。

## Detailed specification

### Overall conventions

在下方的图示中，一个这样的`box`表示一个字节：

``` text
+---+ 
|   | <-- the vertical bars might be missing 
+---+
```

而类似于这样的`box`表示可变的字节数：

``` text
+==============+ 
|              | 
+==============+
```

**存储在计算机中的字节不具有“位序”，因为它们总是被视作一个单位来处理**。然而，将字节视为介于$0 \sim 255$之间的整数确实具有最高有效位和最低有效位，因为我们总是以最高有效数字在左侧的方式书写数字，因此我们也以最高有效位在左侧的方式书写字节。

在下方的图示中，我们对一个字节的比特进行编号，使得比特`0`是最低有效位。

``` text
+--------+ 
|76543210| 
+--------+
```

**由于本文描述的数据格式是面向字节的，而不是面向比特的；因此，本文没有解决字节的比特在比特序列介质上传输的顺序问题**。

在计算机中，一个数字可能占据多个字节。在这里描述的格式中，**所有的多字节数字都是以最低有效位优先的方式存储**(**即在较低的内存地址处**)。  

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

### File format  

一个`gzip`文件由一系列"成员"(压缩数据集)组成。每个成员的格式在下面会详细说明。成员只是在文件中一个接一个地出现，在它们之前、之间或之后没有额外的信息。  

### Member format  

每一个成员都有如下结构:  

```text
+---+---+---+---+---+---+---+---+---+---+ 
|ID1|ID2|CM |FLG|     MTIME     |XFL|OS | (more-->) 
+---+---+---+---+---+---+---+---+---+---+
```
[rfc1952-GZIP-file-format-specification.md](rfc1952-GZIP-file-format-specification.md)
如果`FLG::FEXTRA`字段被设置:

``` text
+---+---+=================================+ 
| XLEN |...XLEN bytes of "extra field"...| (more-->) 
+---+---+=================================+
```

如果`FLG::FNAME`字段被设置:

```text
+=========================================+ 
|...original file name, zero-terminated...| (more-->) 
+=========================================+
```

如果`FLG::FCOMMENT`字段被设置:

```text
+===================================+ 
|...file comment, zero-terminated...| (more-->) 
+===================================+
```

如果`FLG::FHCRC`字段被设置:

```text
+---+---+ 
| CRC16 | 
+---+---+

+=======================+ 
|...compressed blocks...| (more-->) 
+=======================+

  0   1   2   3   4   5   6   7 
+---+---+---+---+---+---+---+---+ 
|     CRC32     |     ISIZE     | 
+---+---+---+---+---+---+---+---+
```

#### Member header and trailer

##### ID1(IDentification 1)

##### ID2(IDentification 2)

这两个字段是固定值：$ID1 = 31(0x1f, \037)，ID2 = 139(0x8b, \213)$，**用于标识文件为**`gzip`格式。

##### CM(Compression Method)

该字段确定了文件中使用的压缩方法。$CM = 0 - 7$被保留，$CM = 8$表示`deflate`压缩方法，这是`gzip`习惯使用的压缩方法，其他文档中有详细说明。

##### FLG(FLaGs)

该标志字段被划分为单个比特，如下表所示：

| bit | 位 |    标识    |
|:---:|:-:|:--------:|
| bit | 0 |  FTEXT   |
| bit | 1 |  FHCRC   |
| bit | 2 |  FEXTRA  |
| bit | 3 |  FNAME   |
| bit | 4 | FCOMMENT |
| bit | 5 | reserved |
| bit | 6 | reserved |
| bit | 7 | reserved |

如果`FTEXT`被设置，该文件就很可能是`ASCII`文本。这是一个可选的指示，**压缩器可以通过减少少量的输入数据来查看是否存在任何非**`ASCII`**字符**。如果存疑，`FTEXT`将会被重置，表示二进制数据。对于`ASCII`文本和二进制数据格式不同的系统，解压器可以使用`FTEXT`选项选择合适的文件格式。**我们有意不指定此位的算法，因为压缩程序始终有可能将其清零，而解压程序始终有可能忽略它，让其他程序处理数据转换的问题**。

> FTEXT
>> 在压缩和解压缩过程中，如果`FTEXT`字段被设置为`1`，压缩器和解压器可以相应地进行处理，以确保数据的正确性和可读性。如果`FTEXT`字段被设置为`0`，压缩器和解压器可以将数据视为二进制数据处理，而不会进行额外的文本处理。这样设计是为了提高灵活性，使得`gzip`格式可以适应不同类型的数据。

如果`FHCRC`被设置，则在压缩数据的前面，`gzip`头部存在一个`CRC16`数据。`CRC16`由`gzip`头部中直到`CRC16`之前的所有字节的`CRC32`的最低有效字节组成。

```c 
ID1 = 32
ID2 = 139
CM = 8
FLG = 2
CRC32 = 0x11223344

==> CRC16 = 0x3344
```

如果`FEXTRA`被设置，则存在可选的额外字段(将会在后续介绍)。

如果`FNAME`被设置，则存在一个原始文件名，**以零字节终止**。名称必须以`ISO 8859-1(LATIN-1)`字符组成;在使用`EBCDIC`或任何其他字符集作为文件名的操作系统上，必须将文件名翻译为`ISO LATIN-1`字符集。**这是被压缩的文件的原始名称，其中已删除了任何目录组件，并且如果被压缩的文件位于不区分大小写的文件系统上，则将其强制转换为小写**。**如果数据不是从具名文件而是从其他来源压缩的，则没有原始文件名**；例如，如果数据源是`Unix`系统上的`stdin`，则没有文件名。

> [零字节终止文件名]
>> 原始文件名以零字节终止，这意味着在gzip文件格式中，原始文件名的末尾是一个零字节（ASCII码为0）。这个零字节用来表示文件名的结束，后面可能会跟随其他数据。这种方式使得解压缩程序可以轻松地确定原始文件名的结束位置，而不必依赖于固定长度或其他分隔符。  
>> "example.txt" => 65 78 61 6d 70 6c 65 2e 74 78 74 00  
> 
> [ISO LATIN-1字符集](https://cs.stanford.edu/people/miles/iso8859.html)
>> 它定义了用于拉丁字母语言的8位字符编码，覆盖了大多数西欧语言，如英语、法语、德语、西班牙语、意大利语等。`ISO LATIN-1`编码的范围是`0x00`到`0xFF`，其中包含了基本拉丁字母、拉丁字母补充、数字、标点符号以及一些特殊字符。
> 
> [EBCDIC(Extended Binary Coded Decimal Interchange Code)](https://www.ibm.com/docs/en/zos-basic-skills?topic=mainframe-ebcdic-character-set)
>> 通常用于`IBM`的大型机系统（如`System/360`，`System/370`和`zSeries`）。与`ASCII`和`ISO Latin-1`不同，`EBCDIC`编码使用8位编码，并且其编码值与`ASCII`或`ISO Latin-1`中的对应字符不同。`EBCDIC`编码方案包含了数字、字母、标点符号和其他特殊字符。

如果`FCOMMENT`被设置，**则存在一个以零字节终止的文件注释。此注释不会被解释；它仅供人类阅读**。注释必须由`ISO 8859-1(LATIN-1)`字符组成。换行应该用单个换行字符(10进制)表示。

**预留的FLG位应该被置零**。

##### MTIME(Modification TIME)

该字段给出了源文件被压缩时的最近修改时间。这个时间是`Unix`格式的(也就是格林威治时间)。(**注意，这可能会给`MSDOS`和其他使用本地时间而非全球时间的系统带来问题**)。如果压缩后的数据不是来自于文件，那么`MTIME`则会被设置为压缩开始的时间。$MTIME = 0$表示没有可用的时间戳。

##### XFL(eXtra FLags)

这些标志位可以通过特定的压缩方法使用。`DEFLATE`方法($CM = 8$)将这些标志位设置如下：

- $XFL = 2$表示压缩器使用最大压缩、最慢算法
- $XFL = 4$表示压缩器使用最快算法

##### OS(Operating System)

该字段标识了发生压缩的文件系统类型，这对于确定文本文件的行尾约定可能是有用的。

| bit |                  type                  |
|:---:|:--------------------------------------:|
|  0  | FAT filesystem(MS-DOS, OS/2, NT/Win32) |
|  1  |                 Amiga                  |
|  2  |            VMS(or OpenVMS)             |
|  3  |                  Unix                  |
|  4  |                 VM/CMS                 |
|  5  |               Atari TOS                |
|  6  |       HPFS filesystem(OS/2, NT)        |
|  7  |               Macintosh                |
|  8  |                Z-System                |
|  9  |                  CP/M                  |
| 10  |                TOPS-20                 |
| 11  |          NTFS filesystem(NT)           |
| 12  |                  QDOS                  |
| 13  |              Acorn RISCOS              |
| 255 |                unknown                 |


> 常见的行尾约定为：
>> Unix/Linux -> LF  
>> Windows -> CRLF  
>> macOS -> CR

##### XLEN(eXtra LENgth)

如果`FLG::FEXYRA`被设置，给出一个可选的额外字段的长度，详情见下文。

##### CRC32(CRC-32)

这个字段包含了未压缩数据的循环冗余校验值，根据ISO 3309标准和ITU-T推荐V.42中的CRC-32算法计算得出。你可以在 http://www.iso.ch 上订购ISO文件。你也可以在 gopher://info.itu.ch 上找到ITU-T V.42的在线版本。

> [CRC-32 ISO3309](https://cdn.standards.iteh.ai/samples/8561/ee3e6fc1cc8641fabff5257e9660cf07/ISO-IEC-3309-1993.pdf)
>> 定义了一种循环冗余校验（CRC）算法，用于检测数据的传输错误。具体来说，ISO 3309标准描述了CRC-32算法，这是一种32位的循环冗余校验算法，常用于检测数据的完整性。  
>> CRC-32算法通过对数据流进行多项式除法运算来计算校验值，然后将该校验值附加到数据流中。接收方可以使用相同的CRC-32算法来计算接收到的数据的校验值，并将其与发送方提供的校验值进行比较，从而检测数据是否在传输过程中发生了错误或损坏。
> 
> [ITU-T V.42](https://www.itu.int/rec/T-REC-V.42/en)
>> 具体而言，ITU-T V.42标准涵盖了数据压缩、误码纠正和数据流控制等方面的内容。其中，压缩算法和误码纠正技术对于提高数据传输效率和减少传输错误非常重要。在ITU-T V.42中提到的CRC-32算法是用于数据传输中的校验和验证，以确保数据的完整性。  
>> ITU-T V.42标准的发布旨在促进数据通信技术的发展和应用，为各种类型的数据通信提供了一个共同的技术框架和标准化的基础。这有助于不同厂商和组织之间的互操作性，并为用户提供了更可靠和高效的数据通信解决方案。

##### ISIZE(Input SIZE)

该字段包含了原始输入数据(未压缩数据)$mod 2^{32}$的大小

##### Extra field 

如果`FLG::FEXTRA`被设置，那么一个“额外字段”就会出现在头部中，总长度为`XLEN`字节。它由一系列子字段组成，每一个子字段的形式都是如下所示：

```text
+---+---+---+---+==================================+ 
|SI1|SI2|  LEN  |... LEN bytes of subfield data ...| 
+---+---+---+---+==================================+
```

`SI1`和`SI2`提供了一个子字段`ID`，通常是两个具有一定助记符价值的`ASCII`字母。[**Jean-Loup Gailly**]<gzip@prep.ai.mit.edu>维护着一个子字段ID的注册表；请将您希望使用的任何子字段`ID`发送给他。`SI2`为`0`的子字段`ID`保留供将来使用。当前已定义的子字段`ID`如下:

```text
SI1         SI2         Data 
----------  ----------  ---
0x41 ('A')  0x70 ('P')  Apollo file type information
```

`LEN`字段给出了子字段数据的长度，不包括四个初始字节。

##### Compliance

**符合规范的压缩器必须生成具有正确的**`ID1`、`ID2`、`CM`、`CRC32`和`ISIZE`**字段的文件，但可以将头部固定长度部分中的所有其他字段设置为默认值**(`OS`字段为`255`，其他字段为`0`)。**压缩器必须将所有保留位设置为零**。

**符合规范的解压器必须检查**`ID1`、`ID2`和`CM`，**并在其中任何一个具有不正确的值时提供错误指示**。**它必须至少检查**`FEXTRA/XLEN`、`FNAME`、`FCOMMENT`和`FHCRC`，**以便在这些可选字段存在时可以跳过它们。它不需要检查头部或尾部的任何其他部分；特别是，解压器可以忽略**`FTEXT`和`OS`**并始终生成二进制输出，仍然符合规范。如果任何保留位为非零，则符合规范的解压器必须提供错误指示，因为这样的位可能指示存在新字段，这将导致后续数据被错误解释**。

## Security Considerations

任何数据压缩方法都涉及减少数据中的冗余。因此，对数据的任何损坏可能会产生严重影响，并且很难纠正。另一方面，未压缩的文本可能仍然可读，尽管存在一些损坏的字节。

建议使用这种数据格式的系统提供某种验证压缩数据完整性的手段，例如设置和检查CRC-32校验值。

## Appendix: Jean-Loup Gailly's gzip utility


gzip压缩的最广泛使用的实现，以及这个规范的原始文档，是由[**Jean-Loup Gailly**]<gzip@prep.ai.mit.edu>创建的。由于这个实现已成为事实上的标准，我们在这里提到了一些它的更多特性。**再次强调，本节中的内容并不是规范的一部分，实现不必遵循它才能符合规范**。

**在压缩或解压缩文件时，**`gzip`**会保留本地文件系统上的保护、所有权和修改时间属性，因为**`gzip`**文件格式本身没有提供表示保护属性的方法。由于文件格式包含修改时间，**`gzip`**解压缩器提供了一个命令行开关，将文件的修改时间分配给解压后的输出，而不是使用压缩输入的本地修改时间**。

## Appendix: Sample CRC Code

以下示例代码表示了`CRC(循环冗余校验)`的实际实现。(也请参阅`ISO 3309`和`ITU-T V.42`进行正式规范。）

```c 
#include <stdio.h>
#include <stdint.h>

// CRC table for fast computation
uint32_t crc_table[256];
int crc_table_computed = 0;

/**
 * Make the table for a fast CRC.
 */
void make_crc_table(void) {
    uint32_t c;
    int n, k;
    
    for (n = 0; n < 256; n++) {
        c = (uint32_t)n;
        for (k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xedb88320L ^ (c >> 1);
            } else {
                c = c >> 1;
            }
        }
        crc_table[n] = c;
    }
    crc_table_computed = 1;
}

/**
 * Update a running crc with the bytes buf[0..len-1] and return the updated crc. 
 * The crc should be initialized to zero. Pre- and post-conditioning (one’s complement) is performed 
 * within this function so it shouldn’t be done by the caller. Usage example:
 */
uint32_t update_crc(uint32_t crc, unsigned char* buf, int len) {
    uint32_t c = crc ^ 0xffffffffL;
    int n;
    
    if (!crc_table_computed) 
        make_crc_table();
    for (n = 0; n < len; n++) {
        c = crc_table[(c ^ buf[n]) & 0xff] ^ (c >> 8);
    }
    return c ^ 0xffffffffL;
}

/**
 * Return the CRC of the bytes buf[0..len-1].
 */
uint32_t crc(unsigned char* buf, int len) {
    return update_crc(0L, buf, len);
}

int main() {
    // Example usage:
    unsigned char buffer[] = "Hello, world!";
    int length = sizeof(buffer) - 1;    // Exclude the null terminator
    uint32_t original_crc = 0x12345678; // Original CRC, for comparison

    // Calculate CRC
    uint32_t crc_value = crc(buffer, length);

    // Verify CRC
    if (crc_value != original_crc)
        printf("Error: CRC does not match!\n");
    else
        printf("CRC matches!\n");

    return 0;
}
```