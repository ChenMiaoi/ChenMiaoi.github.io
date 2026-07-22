---
slug: rfc1952-GZIP-file-format-specification.en
title: 'rfc1952: GZIP file format specification'
published: 2024-05-09
tags:
  - rfc
  - gzip
category: rfc
series: rfc
lang: "en"
---
## Abstract

This specification defines a lossless compressed data format that is compatible with the widely used `GZIP` utility. The format includes a `cyclic redundancy check (CRC)` value for detecting data corruption. The format currently uses the `DEFLATE` compression method, but can be easily extended to use other compression methods. The format can be readily implemented in a manner not covered by patents.

## Introduction

### Purpose

The purpose of this specification is to define a lossless compressed data format that:

- Is independent of `CPU` type, operating system, file system, and character set, and hence can be used interchangeably;
- **Can compress or decompress a data stream (as opposed to a file on a randomly accessible medium) to produce another data stream, using only an a priori bounded amount of intermediate storage, and hence can be used in data communications or similar structures**, such as `Unix filters`;
- **Compresses data with an efficiency comparable to the best currently available general-purpose compression methods**, and in particular considerably better than the "compress" program;
- **Can be implemented readily in a manner not covered by patents**, and hence can be practiced freely;
- **Is compatible with the file format produced by the currently widespread** `gzip` **utility, in that conforming decompressors will be able to read data produced by the existing** `gzip` **compressor**.

> Can compress or decompress a data stream:
>> Converting data into a more compact representation to reduce the space it occupies;  
> 
> Uses only a limited amount of intermediate storage:  
>> In other words, the size of the data is computed up front and does not grow with the size of the data stream; **could using a buffer perhaps improve performance to some degree**?  
> 
> Not covered by patents:
>> **There is no patent protection associated with this compression format**. In other words, using this compression format does not infringe on anyone else's patent rights, because the design of the format does not involve patented technologies or methods. This means anyone is free to implement, use, and distribute this compression format without worrying about infringing others' intellectual property.  

The data format defined by this specification does not attempt to:

- Provide random access to compressed data;
- Compress specialized data as well as the best currently available specialized algorithms;

### Intended audience

This specification is intended for use by implementors of software **to compress data into the** `gzip` **format and/or decompress data from the** `gzip` format.

The text of the specification assumes a basic background in programming at the level of bits and other primitive data representation concepts.

### Scope

This specification defines a compression method and a file format (**the latter assuming only that a file can store an arbitrary sequence of bytes**). It does not specify any particular interface to a file system, nor does it cover anything about character sets or encodings (except for file names and comments, which are optional).

### Compliance

Unless otherwise indicated below, **a compliant decompressor must be able to accept and decompress any file that conforms to all the specifications presented here; a compliant compressor must produce files that conform to all the specifications presented here**. The material in the appendices is not part of the specification itself and is not relevant to compliance.

### Definitions of terms and conventions used 

`byte`: An `8-bit` quantity stored or transmitted as a unit. (For the purposes of this specification, a byte is exactly 8 bits, even on computers that store a byte in a number of bits different from 8.)

### Changes from previous versions

There have been no technical changes to the `gzip` format since version `4.1` of this specification. In version `4.2`, some terminology was changed, and the sample `CRC` code was rewritten for clarity and to eliminate the requirement for the caller to perform pre- and post-conditioning. Version `4.3` is a conversion of the specification into `RFC` style.

## Detailed specification

### Overall conventions

In the diagrams below, a `box` like this represents one byte:

```text
+---+ 
|   | <-- the vertical bars might be missing 
+---+
```

while a `box` like this represents a variable number of bytes:

```text
+==============+ 
|              | 
+==============+
```

**Bytes stored in a computer do not have a "bit order", since they are always treated as a unit**. However, a byte considered as an integer between $0 \sim 255$ does have a most significant bit and a least significant bit, and since we always write numbers with the most significant digit on the left, we also write bytes with the most significant bit on the left.

In the diagram below, we number the bits of a byte so that bit `0` is the least significant bit:

```text
+--------+ 
|76543210| 
+--------+
```

**Since the data format described here is byte-oriented rather than bit-oriented, this document does not address the issue of the order in which the bits of a byte are transmitted on a bit-sequential medium**.

In a computer, a number may occupy multiple bytes. In the format described here, **all multi-byte numbers are stored least significant byte first** (**i.e., at the lower memory address**).  

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

A `gzip` file consists of a series of "members" (compressed data sets). The format of each member is specified in detail below. The members simply appear one after another in the file, with no additional information before, between, or after them.  

### Member format  

Each member has the following structure:  

```text
+---+---+---+---+---+---+---+---+---+---+ 
|ID1|ID2|CM |FLG|     MTIME     |XFL|OS | (more-->) 
+---+---+---+---+---+---+---+---+---+---+
```
[rfc1952-GZIP-file-format-specification.md](rfc1952-GZIP-file-format-specification.md)
If `FLG::FEXTRA` is set:

```text
+---+---+=================================+ 
| XLEN |...XLEN bytes of "extra field"...| (more-->) 
+---+---+=================================+
```

If `FLG::FNAME` is set:

```text
+=========================================+ 
|...original file name, zero-terminated...| (more-->) 
+=========================================+
```

If `FLG::FCOMMENT` is set:

```text
+===================================+ 
|...file comment, zero-terminated...| (more-->) 
+===================================+
```

If `FLG::FHCRC` is set:

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

These two fields have fixed values: $ID1 = 31(0x1f, \037)，ID2 = 139(0x8b, \213)$, **and are used to identify the file as being in** `gzip` format.

##### CM(Compression Method)

This field identifies the compression method used in the file. $CM = 0 - 7$ is reserved, and $CM = 8$ denotes the `deflate` compression method, which is the one customarily used by `gzip` and is documented elsewhere.

##### FLG(FLaGs)

This flag field is divided into individual bits, as shown in the following table:

| bit | bit |    flag    |
|:---:|:-:|:--------:|
| bit | 0 |  FTEXT   |
| bit | 1 |  FHCRC   |
| bit | 2 |  FEXTRA  |
| bit | 3 |  FNAME   |
| bit | 4 | FCOMMENT |
| bit | 5 | reserved |
| bit | 6 | reserved |
| bit | 7 | reserved |

If `FTEXT` is set, the file is probably `ASCII` text. This is an optional indication; **the compressor can examine a small sample of the input data to see whether any non-**`ASCII`**characters are present**. If in doubt, `FTEXT` is cleared, indicating binary data. On systems for which `ASCII` text and binary data have different formats, a decompressor can use `FTEXT` to select the appropriate file format. **We deliberately do not specify the algorithm for this bit, since a compressor always has the option of clearing it, and a decompressor always has the option of ignoring it, leaving the data-conversion issue to other programs**.

> FTEXT
>> During compression and decompression, if the `FTEXT` field is set to `1`, the compressor and decompressor can handle the data accordingly to ensure its correctness and readability. If the `FTEXT` field is set to `0`, the compressor and decompressor can treat the data as binary data without performing any additional text processing. This design improves flexibility, allowing the `gzip` format to adapt to different types of data.

If `FHCRC` is set, a `CRC16` is present in the `gzip` header, immediately before the compressed data. The `CRC16` consists of the two least significant bytes of the `CRC32` of all the bytes of the `gzip` header up to (not including) the `CRC16` itself.

```c 
ID1 = 32
ID2 = 139
CM = 8
FLG = 2
CRC32 = 0x11223344

==> CRC16 = 0x3344
```

If `FEXTRA` is set, optional extra fields are present (described below).

If `FNAME` is set, an original file name is present, **terminated by a zero byte**. The name must consist of `ISO 8859-1(LATIN-1)` characters; on operating systems that use `EBCDIC` or any other character set for file names, the name must be translated into the `ISO LATIN-1` character set. **This is the original name of the file being compressed, with any directory components removed, and forced to lowercase if the compressed file resides on a case-insensitive file system**. **If the data was compressed from a source other than a named file, there is no original file name**; for example, if the data source is `stdin` on a `Unix` system, there is no file name.

> [Zero-byte-terminated file name]
>> The original file name is terminated by a zero byte, which means that in the gzip file format the end of the original file name is a zero byte (ASCII code 0). This zero byte marks the end of the file name and may be followed by other data. This makes it easy for the decompression program to determine where the original file name ends, without relying on a fixed length or other delimiters.  
>> "example.txt" => 65 78 61 6d 70 6c 65 2e 74 78 74 00  
> 
> [ISO LATIN-1 character set](https://cs.stanford.edu/people/miles/iso8859.html)
>> It defines an 8-bit character encoding for languages that use the Latin alphabet, covering most Western European languages such as English, French, German, Spanish, and Italian. The `ISO LATIN-1` encoding ranges from `0x00` to `0xFF` and includes the basic Latin alphabet, the Latin-1 supplement, digits, punctuation, and a number of special characters.
> 
> [EBCDIC(Extended Binary Coded Decimal Interchange Code)](https://www.ibm.com/docs/en/zos-basic-skills?topic=mainframe-ebcdic-character-set)
>> Commonly used on `IBM` mainframe systems (such as `System/360`, `System/370`, and `zSeries`). Unlike `ASCII` and `ISO Latin-1`, `EBCDIC` uses 8-bit encoding, and its encoding values differ from the corresponding characters in `ASCII` or `ISO Latin-1`. The `EBCDIC` encoding scheme includes digits, letters, punctuation, and other special characters.

If `FCOMMENT` is set, **a zero-byte-terminated file comment is present. This comment is not interpreted; it is intended only for human consumption**. The comment must consist of `ISO 8859-1(LATIN-1)` characters. Line breaks should be denoted by a single line feed character (10 decimal).

**The reserved FLG bits should be set to zero**.

##### MTIME(Modification TIME)

This field gives the most recent modification time of the source file at the time it was compressed. The time is in `Unix` format (i.e., Greenwich Mean Time). (**Note that this may cause problems for `MSDOS` and other systems that use local time rather than Universal Time**.) If the compressed data did not come from a file, `MTIME` is set to the time at which compression started. $MTIME = 0$ means no time stamp is available.

##### XFL(eXtra FLags)

These flags are available for use by specific compression methods. The `DEFLATE` method ($CM = 8$) sets these flags as follows:

- $XFL = 2$ indicates that the compressor used maximum compression with the slowest algorithm
- $XFL = 4$ indicates that the compressor used the fastest algorithm

##### OS(Operating System)

This field identifies the type of file system on which compression took place; this may be useful for determining the end-of-line convention for text files.

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


> Common end-of-line conventions:
>> Unix/Linux -> LF  
>> Windows -> CRLF  
>> macOS -> CR

##### XLEN(eXtra LENgth)

If `FLG::FEXYRA` is set, this gives the length of the optional extra field; see below for details.

##### CRC32(CRC-32)

This field contains a cyclic redundancy check value of the uncompressed data, computed according to the CRC-32 algorithm of the ISO 3309 standard and ITU-T recommendation V.42. You can order ISO documents from http://www.iso.ch. You can also find an online version of ITU-T V.42 at gopher://info.itu.ch.

> [CRC-32 ISO3309](https://cdn.standards.iteh.ai/samples/8561/ee3e6fc1cc8641fabff5257e9660cf07/ISO-IEC-3309-1993.pdf)
>> Defines a cyclic redundancy check (CRC) algorithm for detecting transmission errors in data. Specifically, the ISO 3309 standard describes the CRC-32 algorithm, a 32-bit cyclic redundancy check algorithm commonly used to verify data integrity.  
>> The CRC-32 algorithm computes a check value by performing polynomial division on the data stream and then appends that check value to the data stream. The receiver can use the same CRC-32 algorithm to compute the check value of the received data and compare it with the check value provided by the sender, thereby detecting whether the data was corrupted or errored during transmission.
> 
> [ITU-T V.42](https://www.itu.int/rec/T-REC-V.42/en)
>> Specifically, the ITU-T V.42 standard covers data compression, error correction, and data flow control. Among these, compression algorithms and error-correction techniques are very important for improving data transmission efficiency and reducing transmission errors. The CRC-32 algorithm mentioned in ITU-T V.42 is used for checksum verification in data transmission to ensure data integrity.  
>> The ITU-T V.42 standard was published to promote the development and application of data communication technologies, providing a common technical framework and standardized foundation for various types of data communication. This helps interoperability between different vendors and organizations and provides users with more reliable and efficient data communication solutions.

##### ISIZE(Input SIZE)

This field contains the size of the original input data (uncompressed data) $mod 2^{32}$.

##### Extra field 

If `FLG::FEXTRA` is set, an "extra field" is present in the header, with a total length of `XLEN` bytes. It consists of a series of subfields, each of the form:

```text
+---+---+---+---+==================================+ 
|SI1|SI2|  LEN  |... LEN bytes of subfield data ...| 
+---+---+---+---+==================================+
```

`SI1` and `SI2` provide a subfield `ID`, typically two `ASCII` letters with some mnemonic value. [**Jean-Loup Gailly**]<gzip@prep.ai.mit.edu> maintains a registry of subfield IDs; please send him any subfield `ID` you wish to use. Subfield `ID`s with `SI2` = `0` are reserved for future use. The currently defined subfield `ID`s are:

```text
SI1         SI2         Data 
----------  ----------  ---
0x41 ('A')  0x70 ('P')  Apollo file type information
```

The `LEN` field gives the length of the subfield data, excluding the four initial bytes.

##### Compliance

**A compliant compressor must produce files with correct** `ID1`, `ID2`, `CM`, `CRC32` **and** `ISIZE` **fields, but may set all the other fields in the fixed-length part of the header to default values** (`255` for `OS` and `0` for all the others). **The compressor must set all reserved bits to zero**.

**A compliant decompressor must check** `ID1`, `ID2` **and** `CM`, **and provide an error indication if any of these have incorrect values**. **It must examine at least** `FEXTRA/XLEN`, `FNAME`, `FCOMMENT` **and** `FHCRC`, **so that it can skip over the optional fields if they are present. It need not examine any other part of the header or trailer; in particular, a decompressor can ignore** `FTEXT` **and** `OS` **and always produce binary output while still being compliant. If any reserved bit is non-zero, a compliant decompressor must give an error indication, since such a bit could indicate the presence of a new field, which would cause subsequent data to be interpreted incorrectly**.

## Security Considerations

Any data compression method involves the reduction of redundancy in the data. Consequently, any corruption of the data is likely to have severe effects and be difficult to correct. Uncompressed text, on the other hand, will probably still be readable despite the presence of some corrupted bytes.

It is recommended that systems using this data format provide some means of validating the integrity of the compressed data, such as by setting and checking the CRC-32 check value.

## Appendix: Jean-Loup Gailly's gzip utility


The most widely used implementation of gzip compression, and the original documentation on which this specification is based, were created by [**Jean-Loup Gailly**]<gzip@prep.ai.mit.edu>. Since this implementation has become a de facto standard, we mention some more of its features here. **Again, the material in this section is not part of the specification, and implementations need not follow it to be compliant**.

**When compressing or decompressing a file,** `gzip` **preserves the protection, ownership, and modification time attributes on the local file system, since the** `gzip` **file format itself provides no way of representing protection attributes. Since the file format includes a modification time, the** `gzip` **decompressor provides a command line switch that assigns the modification time from the file to the decompressed output, rather than using the local modification time of the compressed input**.

## Appendix: Sample CRC Code

The following sample code represents a practical implementation of the `CRC (cyclic redundancy check)`. (See also `ISO 3309` and `ITU-T V.42` for a formal specification.)

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
