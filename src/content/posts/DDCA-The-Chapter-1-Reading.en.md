---
slug: DDCA-The-Chapter-1-Reading.en
title: 'DDCA: The Chapter 1 Reading'
published: 2024-04-09
updated: 2024-04-09
tags:
  - ysyx
  - digital
  - logic
category: books
series: ddca
lang: "en"
---
> First of all, I must make one thing clear: **all the articles and notes that follow are not blog posts or a knowledge-teaching series; they serve only as my personal study records and reflections. Therefore, *some of the knowledge in them may not be comprehensive or fully accurate.***

The name `DDCA` of these study notes carries a certain meaning: for one thing, it is a course at `ETHz(苏黎世联邦理工学院)`, [Digital Design and Computer Architecture](https://safari.ethz.ch/digitaltechnik/spring2023/doku.php?id=schedule); it is also the name of an introductory book, `Digital Design and Computer Architecture`. For me, this is also my first systematic `Architecture` course and the first book I read on the subject. 

I sincerely hope that these reading notes will be helpful to you. At the same time, these notes adopt a mixed Chinese-English style, trying as much as possible not to deviate too far from the reader's understanding of the original work.

## The GAME PLAN  

This section states the goal of the whole book: **how to design and build your own microprocessor**. The book is devoted to describing **the design of digital systems — in particular, how to make them run on machines of `1`s and `0`s**.  

Moreover, this section points out that one great advantage of digital systems is that they are **simple enough** — there is only `1` and `0`. Of course, this is closely related to the binary system in digital systems discussed later, and it also involves Boolean algebra (we will come back to that later).  

## The Art of Managing Complexity  

> One of the characteristics that separates an engineer or computer scientist from a layperson is a systematic approach to managing complexity.  

**One of the characteristics that separates an engineer or computer scientist from a layperson is a systematic approach to managing complexity.** In other words, you need to learn how to build a microprocessor without getting stuck in the quagmire of its details.

Obviously, these concepts are very common in life, study, and projects. We need to set a clear goal, and we also need a good **Hierarchical Abstraction**.

### Abstraction

> The critical technique for managing complexity is abstraction: hiding details when they are not important. 

**The critical technique for managing complexity lies in `抽象(Abstraction)`: hiding details when they are not important** (**or, in other words, hiding the unimportant details**). A system can usually be viewed from many different levels of abstraction:

- For example, the levels of abstraction of an electronic computer system, and the classic building blocks at each level (from top to bottom):
  - Application Software, Programs
  - Operator Systems, Device Drivers
  - Architecture, Instructions Registers
  - Micro-architecture, Datapaths Controllers
  - Logic, Adders Memories
  - Digital Circuits, AND Gates and NOT Gates
  - Analog Circuits, Amplifiers Filters
  - Devices, Transistors Diodes
  - Physics, Electrons

The lowest level of abstraction is physics, that is, the motion of electrons. The behavior of electrons is described by quantum mechanics and Maxwell's equations. Our systems are built from electronic devices such as transistors (or vacuum tubes, which are now obsolete).

The next level of abstraction is **analog circuits**, where various devices are assembled to create components such as amplifiers; **analog circuits input and output a continuous range of voltages**.  

**Digital circuits**, on the other hand, restrict voltages to discrete ranges, which we use to represent `0` and `1`. At the subsequent logic level (`Logic`), we build more complex structures from digital circuits, such as adders or memories.  

Micro-architecture connects the abstract logic level and the architecture level. **The abstraction of the architecture level describes a computer from the programmer's point of view.** **Micro-architecture involves combining logic elements to execute the instructions defined by the architecture.**

As for the software level and the operating system level, I will not elaborate on them here. **This book mainly focuses on the levels of abstraction from digital circuits through computer architecture.**

Before going into the more detailed content, there is one sentence worth pondering:

> **When you are working at one level of abstraction, it is good to know something about the levels of abstraction immediately above and below where you are working.**  

### Discipline 

> Discipline is the act of intentionally restricting your design choices so that you can work more productively at a higher level of abstraction.  

**Discipline (actually, I prefer to call it "convention") is the act of intentionally restricting your design choices so that you can work more productively at a higher level of abstraction.**

This sentence is somewhat hard to understand. It emphasizes that **during the design and implementation process, one should take the requirements of the upper levels and substitutability into account, so that when providing abstract interfaces to the upper levels, upper-level users can use them more flexibly and efficiently. The design and implementation of discipline ensures that no unnecessary complexity and confusion arises when working at a higher level of abstraction**.

Combining the above, in the content of this book, discipline in the digital sense is very important: consider that digital circuits use discrete voltages, while analog circuits use continuous voltages. Therefore, digital circuits are a subset of analog circuits. In a sense, **digital circuits must be capable of less than the broader class of analog circuits**.

So, should we then choose analog circuits as our discipline? **No. However, digital circuits are much, much easier to design. With digital circuits, we can easily combine components into complex systems that ultimately outperform systems built from analog circuits in many applications. Therefore, back to the main topic: this book studies computer architecture with digital circuits as the carrier.**

### The Three-Y's

Besides **abstraction** and **discipline**, designers also use three `y's` to manage complexity: `层次性(Hierarchy)`, `模块性(Modularity)`, and `规律性(Regularity)`:

- **Hierarchy means dividing a system into modules, and then further subdividing each module until all the parts are easy to understand**.
- **Modularity means that modules have well-defined functions and interfaces, so they can be connected together easily without unexpected side effects**.
- **Regularity means seeking uniformity among modules. Common modules are reused many times, reducing the number of different modules that must be designed**.

> I guess some people will surely fail to understand why hierarchy means dividing into modules rather than arranging into levels. Actually, the "modules" here refer to levels in the general sense. For example, `add` and `sub` can be regarded as two modules, and these two modules both belong to the `function` module. As described above, this divides them into two levels.

![Flintlock rifle with a close-up view of the lock](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404101320181.png)

The figure above is an example from the original book; here is a brief introduction:

- In terms of hierarchy
  - The rifle is divided into three components: `Stock`, `Lock`, and `Barrel`
    - `Barrel` is the long metal tube that fires the bullet
    - `Lock` can be divided into: `Flint`, `Cock`, `String`, `Sprint`, and `Pan`
    - `Stock` is the wooden body that holds the parts together and provides a secure grip
  - Each component can be further described hierarchically in more detail
- In terms of modularity
  - Each component should have clearly defined functions and interfaces
    - The function of `Stock` is to assemble the `Lock` and the `Barrel`; its interface consists of its length and the mounting pin positions
    - The function of `Barrel` is to impart a spin to the bullet, making it travel more accurately
    - ...
  - **Modularity requires that there be no side effects**: the design of `Stock` should not interfere with the function of `Barrel`
- In terms of regularity
  - A damaged `Barrel` can be replaced by an identical part, and `Stock`s can be built efficiently on an assembly line rather than laboriously by hand

## The Digital Abstraction

> Most physical variables are continuous. For example, the voltage on a wire, the frequency of an oscillation, or the position of a mass are all continuous quantities. Digital systems, on the other hand, represent information with discrete-valued variables—that is, variables with a finite number of distinct values.  

A digital system represents information with discrete-valued variables — that is, variables with a finite number of distinct values.

Unlike `Babbage's machine`, most electronic computers adopt a binary (two-valued) representation, in which a high voltage represents `1` and a low voltage represents `0`.

![Babbage's machine](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404101756624.png)

Suppose the amount of information is $D$; then the amount of information $D$ in a discrete-valued variable with $N$ distinct states is measured in bits:

$$
  D = \log_2N \ bits
$$

Therefore, a binary variable conveys $\log_22 = 1 \ bit$ of information (in fact, the unit `bit` is a contraction of `binary digit`).

**A continuous signal theoretically contains an infinite amount of information, because it can take on an infinite number of values.** But in practical applications, **for most continuous signals, noise and measurement error limit the information to** $10 \thicksim 16 \ bits$. If you want to transmit information quickly, the amount of information needs to be lower (say, $8 \ bits$).

This book focuses on digital circuits that use binary variables: `1` and `0`. `Boole` developed a logic system that operates on binary variables, known as `布尔逻辑(Boolean Logic)`.

> Every Boolean variable is either `TRUE` or `FALSE`. Electronic computers usually use a positive voltage to represent `1` and zero voltage to represent `0`. Therefore, in this book and in these notes, we will use the terms `1`, `TRUE`, and `HIGH` synonymously; and of course the same goes for `0`, `FALSE`, and `LOW`.

**Programmers can work without needing to understand the detailed details of the computer hardware. On the other hand, understanding the details of the hardware allows programmers to better optimize software for a specific computer.**

## Number Systems

> Unlike most people, who work in the decimal system, we usually work in hexadecimal or binary. So, surely nobody still needs to be taught this, right?

### Decimal Numbers

Let $K$ denote the coefficient, $10$ the base, and $n$ the weight; then we obtain the decimal representation:

$$
  K_n10^n \cdot K_{n-1}10^{n-1} \cdot ... \cdot K_210^2 \cdot K_110^1 \cdot K_010^0 \cdot K_{-1}10^{-1} \cdot K_{-2}10^{-2} \cdot ... \cdot K_{-n+1}10^{-n+1} \cdot K_{-n}10^{-n}
$$

### Binary Numbers

The same as decimal, except that we change the base to $2$:

$$
  K_n2^n \cdot K_{n-1}2^{n-1} \cdot ... \cdot K_22^2 \cdot K_12^1 \cdot K_02^0 \cdot K_{-1}2^{-1} \cdot K_{-2}2^{-2} \cdot ... \cdot K_{-n+1}2^{-n+1} \cdot K_{-n}2^{-n}
$$

### Hexadecimal Numbers

No further elaboration needed:

$$
  K_n16^n \cdot K_{n-1}16^{n-1} \cdot ... \cdot K_216^2 \cdot K_116^1 \cdot K_016^0 \cdot K_{-1}16^{-1} \cdot K_{-2}16^{-2} \cdot ... \cdot K_{-n+1}16^{-n+1} \cdot K_{-n}16^{-n}
$$

### Bytes, Nibbles, and All That Jazz  

Although we already understand number systems, we should also learn some terminology used in computer number systems.

A group of $8 \ bits$ is called $1 \ byte$. Its representation range is: $2^8 = 256$. **The size of objects stored in computer memory is usually measured in `byte`s rather than `bit`s**.

A group of $4 \ bits$, or half a byte, is called $1 \ nibble$ (this is quite an antiquated unit of measurement and is no longer in use).

Microprocessors process data in chunks called `字(words)`; **the size of a `word` depends on the architecture of the microprocessor**.

> A microprocessor is a processor built on a single chip. Until the 1970's, processors were too complex to fit on a single chip.
> In these notes, we will use the terms `微处理器` and `处理器` interchangeably.

In a group of `bits`, the bit in the `1` column (this refers to the bit position, not the first 1 from the right) is called the `最小有效位数(the least significant bit, lsb)`, and the bit at the other end is called the `最大有效位(the most significant bit, msb)`; similarly, within a `word`, there are the `最低有效字节(the least significant byte, LSB)` and the `最高有效字节(the most significant byte, MSB)`.

![Least and most significant bits and bytes](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404101921449.png)

Coincidentally, $2^{10} = 1024 \approx 10^3$. Therefore, the term `kilo` denotes $2^{10}$. Similarly: `MB`, `Mb`, `GB`, and `Gb` denote $2^{20}bytes$, $2^{20}bits$, $2^{30}bytes$, and $2^{30}bits$, respectively.

### Binary Addition 

> There is nothing much to say about this part — it is just normal arithmetic.

### Signed Binary Numbers

We have two ways to represent signed binary numbers: `Sign/Maganitude` and `Two's complement`.

#### Sign/Magnitude Numbers

An $N-bit$ `sign/magnitude` number uses the most significant bit as the sign bit, and the remaining $N-1 \ bits$ as the magnitude (that is, the absolute value).

It is worth noting that: **normal binary addition does not work for `sign/magnitude` numbers, and there is a distinction between positive zero and negative zero**.

#### Two's Complement Numbers

`二进制补码(Two's complement)` numbers overcome the problems of `sign/magnitude` numbers; the range they can represent is: $[2^{N-1}, 2^{N-1} - 1]$.

- The representation of two's complement numbers falls into two cases:
  - If the binary number is positive (including 0), it stays unchanged
  - If the binary number is negative
    - Use 1 as the number serving as the sign bit
    - Represent the remaining bits normally, then invert all bits except the sign bit and add one

Two's complement can also be used to detect whether addition and subtraction cause `溢出(overflow)`:

- How to determine overflow:
  - Overflow only exists in **addition/subtraction of numbers with the same sign**.
  - **If the sign bits of the two numbers are the same, but the sign bit of the computed result is different, overflow has occurred**.

Meanwhile, two's complement has another feature: `符号扩展(signed extension)` — **when a two's complement number is extended to more bits, the sign bit must be copied from its current position all the way up to the `msb`**.

#### Comparison of Number Systems

![Comparison Numbers](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404101943857.png)

## Logic Gates

> Now that we know how to use binary variables to represent information, we explore digital systems that perform operations on these binary variables.

`逻辑门(Logic Gates)` are simple digital circuits that take one or more binary inputs and produce a binary output. Logic gates are drawn with symbols showing the inputs and outputs.

![Gates](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404101949233.png)

### NOT Gate

`非门(NOT Gate)` has one input $A$ and one output $Y$. I will not go into much detail about the description of the NOT gate; **the NOT gate is also called** an `逆变器(inverter)`. In these notes, we use $Y = \overline{A}$ as the notation for the NOT gate.

### Buffer

`缓冲器(buffer)` simply copies the input to the output. Some people may ask, "does this really need to exist?" Of course — if it exists, it must have its value: **from an analog point of view, a buffer may have desirable characteristics, such as being able to deliver a large amount of current to a motor and the like**. Purely from a logical point of view, a buffer is no different from a wire. **This is an example of why we need to understand a system at multiple levels: the digital abstraction hides the real purpose of the buffer**.

### AND Gate

`与门(AND Gate)` has two inputs and one output. We usually denote it as $Y = AB$.

### OR Gate

`或门(OR Gate)` is the same as the AND gate; we denote it as $Y = A + B$.

### Other Two Input Gates

As for the following two-input logic gates, I will not elaborate further — please look them up yourself.

![Other Gates](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102000169.png)

## Beneath The Digital Abstraction

**A digital system uses discrete-valued variables; however, the variables are represented by continuous physical quantities**. This leads to some problems: there is a lot of noise in real systems. If we assume $5V = 1$, then should $4.97V$ also represent $A = 1$? What about $4.3V$? Or even lower values?

### Supply Voltage

Suppose the lowest voltage in the system is $0V$, which is called `groud` or `GND`; the highest voltage in the system comes from the power supply and is usually called $V_{DD}$. **At present, the values of supply voltages have been gradually decreasing as the times advance**.

### Logic Levels

The binary mapping from continuous variables to discrete variables is accomplished by defining `逻辑层次(Logic Levels)`. As shown in the figure below, the first gate is called the `driver`, and the second gate is called the `receiver`.

Suppose the `driver` outputting a voltage in the range $0 \thicksim V_{OL}$ means it has output `LOW(0)`, and outputting a voltage in the range $V_{OH} \thicksim V_{DD}$ means it has output `HIGH(1)`; while the `receiver` receiving a voltage in the range $0 \thicksim V_{IL}$ means the input is `LOW(0)`, and receiving a voltage in the range $V_{IH} \thicksim V_{DD}$ means the input is `HIGH(1)`.

**Due to noise, faulty components, and other reasons, the receiver's input may fall within the `禁区(forbid)` range of $V_{IL} \thicksim V_{IH}$, meaning the gate's behavior is unpredictable at that point**. We now call $V_{OL}$, $V_{OH}$, $V_{IL}$, and $V_{IH}$ the high and low logic levels of the output and the input, respectively.

![Logic levels and noise margins](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102010401.png)

### Noise Margins

To ensure that even when faults or noise exist in the environment, but their influence is not too large, the logic gate can still function properly, we should have a concept called `噪声容量(noise margin)`: **the amount of noise that can be added to a worst-case output**.

As shown in the figure above, when our input is at $V_{OL} \lt NM_{L}$ and $V_{OH} \gt NM_{H}$, the receiver's input can still detect the correct logic level.

> $V_{DD}$ is the voltage on the `漏极(drain)` of metal-oxide-semiconductor transistors, which are used to build most modern chips; it is sometimes also called $V_{CC}$;
> $GND$ is the voltage on the `源极(source)` of metal-oxide-semiconductor transistors; it is sometimes also called $V_{SS}$.

### DC Transfer Characteristics

To understand the limits of the digital abstraction, we must dig deep into the analog behavior of a gate. The `直流转移特性(direct current transfer characteristics)` of a `栅极(gate)` describe the output voltage as a function of the input voltage; **when the input changes slowly enough, the output can be kept unchanged**. This describes the input-output characteristics, and is therefore called the transfer characteristics.

![DC transfer characteristics and logic levels](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102032728.png)

That is, as shown in the figure above, in the ideal case, when $V(A) \lt V_{DD} / 2$, $V(Y) = V_{DD}$. In this case, $V_{IH} = V_{IL} = V_{DD} / 2$, $V_{OH} = V_{DD}$, and $V_{OL} = 0$.

But in reality, for various reasons, the transitions between these endpoints are smooth (that is, they do not switch directly in the piecewise-linear fashion of Figure a), and may not be exactly centered at $V_{DD} / 2$.

A reasonable place to choose the logic levels is where the slope of the transfer characteristic $dV(Y)/dV(A)$ is $-1$; these two points are called the `单位增益点(unity gain points)`. Choosing logic levels at the unity gain points usually maximizes the noise margins.

### The Static Discipline

To prevent inputs from falling into the forbidden zone, digital logic gates have had a discipline since the very beginning of their design: **given logically valid inputs, every circuit element will produce logically valid outputs**.

By conforming to the static discipline, digital designers sacrifice the freedom of using arbitrary analog circuit elements in return for the simplicity and robustness of digital circuits.

**The choice of $V_{DD}$ and logic levels is arbitrary, but all gates that communicate with each other must have compatible logic levels**. Therefore, gates are grouped into `逻辑家族(logic families)`:

![Logic levels of 5 V and 3.3 V logic families](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102051690.png)

## CMOS Transistors

Modern computers use transistors because they are cheap, small, and reliable. Transistors are electrically controlled switches that turn on or off when a voltage or current is applied to a control terminal.

There are two main types of transistors in common use: `双极晶体管(bipolar junction transistors)` and `金属氧化物半导体效应晶体管(metal-oxide-semiconductor field effect transistors)`; the latter are generally called `MOSFETs` or `MOS transistors`.

In this section, we will peek beneath the digital abstraction to see how logic gates are built from `MOS` transistors.

### Semiconductors

MOS transistors are made of silicon atoms. Silicon ($Si$) is a Group &#x2163; atom, so it has four electrons in its valence shell and forms bonds with four neighboring atoms, thereby forming a crystal lattice.

**By itself, silicon is a poor conductor, because all the electrons are bound together in covalent bonds. When small amounts of impurities, i.e. dopant atoms, are carefully added, it becomes a better conductor**.

If a Group &#x2164; dopant (such as $As$) is added, the dopant atom has an extra electron that does not participate in bonding (a free electron). The electron can easily move around the lattice, leaving behind an ionized dopant atom ($As^{+}$), as shown in Figure b below. Since this free electron carries a negative charge, we call it an `n-type掺杂剂`, and the semiconductor built from it is called an `n-type半导体`.

On the other hand, if a Group &#x2162; dopant (such as $B$) is added, the dopant atom lacks an electron; this missing electron is called a `空穴(hole)`. An electron from a neighboring silicon atom can move over to fill the missing bond, forming an ionized dopant atom ($B^{-}$) and leaving a hole at that neighboring silicon atom. Holes can move around the lattice, and since a hole lacks a negative charge, it behaves like a positively charged particle. Therefore, we call this dopant a `p-type掺杂剂`, and the semiconductor built from it a `p-type半导体`.

**Because the conductivity of silicon varies over many orders of magnitude with the concentration of dopants, silicon is called a semiconductor**.

![Silicon lattice and dopant atoms](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102109913.png)

### Diodes

Now we already know: $n-type$ semiconductors have free electrons, while $p-type$ semiconductors have free holes.

When we connect $n-type$ and $p-type$ together, carrier diffusion occurs because the concentrations of carriers (holes and electrons) in the materials are different. Specifically, holes in the $p-type$ diffuse toward the $n-type$, and electrons in the $n-type$ diffuse toward the $p-type$. This diffusion causes a charged region to form near the `PN结(PN junction)`.

During the formation of the $PN$ junction, when holes from the $p-type$ recombine with electrons from the $n-type$, the positive and negative charges cancel each other out, forming a region without carriers, which is called the depletion region. **Inside the depletion region, a built-in electric field is formed; the built-in electric field prevents further carrier diffusion, so the PN junction has a certain unidirectional conductivity**.

Therefore, only when an external voltage is applied — with the $P$ region connected to positive and the $N$ region to negative (and the external voltage greater than the built-in field voltage) — will free electrons flow continuously toward the $P$ region, producing a current from $P \longrightarrow N$. **If the voltage is applied in reverse, it reinforces the built-in voltage; if the reverse voltage is too high, the internal field will be broken down**. Therefore, a diode conducts in only one direction. The diode picture in the figure below vividly illustrates this property.

![diodes](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102130507.png)

![p-n junction and capacitor](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102139188.png)

### Capacitors

A capacitor consists of two conductors separated by an insulator. When a voltage $V$ is applied to one of the conductors, that conductor accumulates charge $Q$, and the other conductor accumulates the opposite charge $-Q$. The capacitance $C$ of a capacitor is the ratio of charge to voltage:

$$
  C = \frac{Q}{V}
$$

The symbol for a capacitor is shown in the figure above. **Capacitance is important because charging or discharging a conductor takes time and energy. More capacitance means a circuit will be slower and require more energy to operate**.

### nMOS and pMOS Transistors

Let us first look at the fabrication process and working principle of the $n-type$.

As shown in the figure below, the bulk of an $nMOS$ uses `p-type` as the `底物(substrate)`; on both sides of the substrate there are two `n-type` regions; the top of the substrate is covered with a layer of silicon dioxide insulator, and on top of that a layer of `多晶硅(Polysilicon)` is filled in. We use metal conductors to bring out metal electrodes from the two `n-type` regions and the polysilicon, respectively.

![nMOS and pMOS transistors](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102152357.png)

One of them is called the `源极(source)`, and the other the `漏极(drain)`; the metal conductor brought out from the polysilicon is called the `栅极(gate)`. The substrate is usually grounded, that is, connected to `GND`.

We find that the two `n-type` regions of the $nMOS$ and the `p-type` substrate happen to form two diodes pointing in opposite directions. This leads to the following: **when the gate is grounded, one of the diodes is conducting while the other is cut off. Therefore, the source and the drain do not conduct, and no current flows. When the gate is connected to the power supply, since the gate now accumulates positive charge and there is an insulator in between, negative charges are attracted to accumulate on the $p-type$ substrate below, driving the holes away. When enough free electrons have accumulated, a `通道(channel)` is formed as shown in Figure b below — here, an $n-channel$. Now there is a continuous path from the $n-type$ source through the $n-channel$ to the $n-type$ drain, so current can flow from the source to the drain; at this point the $nMOS$ is conducting, that is, $ON$.**

![nMOS transistor operation](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404102205244.png)

The fabrication and principle of the $pMOS$ simply swap $n-type$ for $p-type$: **when the gate is grounded, the source and the drain conduct; when the gate is connected to the power supply, the source and the drain are cut off**.

Therefore, $MOS$ transistors **behave as voltage-controlled switches, where the gate voltage creates an electric field that turns the connection between the source and the drain on or off. The name `效场应晶体管(field effect transistor)` comes from this working principle**.

**The gate voltage required to turn a transistor on is called the** `阈值电压(threshold voltage, $V_t$)`, and is typically $0.3 \thicksim 0.7V$.

**Unfortunately**, `MOSFETs` **are not perfect** `开关(switches)`. Here are some of the main reasons:

- On-state resistance issues:
  - In switching applications, ideally a switch should have very high impedance when off to prevent current from flowing, and very low impedance when on to let current pass. `MOSFETs` have a relatively low on-resistance when conducting, but their impedance when off may be relatively high, which can cause some energy loss
- Static power consumption
  - Even when a `MOSFET` is off, leakage current still exists, which can cause some static power consumption. Although this power consumption is relatively small, it can be a problem in some applications, especially for applications that need to stay off for a long time
- Body effect
  - The on-state of a `MOSFET` is controlled by applying a gate voltage, which may be affected by what is called the "body effect". When the gate voltage is low, charge accumulates in the insulating layer between the gate and the channel, and the impedance of the MOSFET may increase, which can make the switching performance unstable
- The relationship between voltage and current
  - In some cases, the conduction characteristics of a `MOSFET` may not fully follow the ideal linear relationship. This may cause the current to not vary strictly as expected at certain voltages, which can pose some design challenges

To build both types of transistors on the same chip, the manufacturing process usually starts with a $pMOS$, and then implants an $nMOS$ in the region where the $pMOS$ will pass, called a `well` (actually, I don't know how to translate this). **These processes that provide both different types of transistors at the same time are called** `互补金属氧化物半导体(Complementary MOS)` or `CMOS`. The $CMOS$ process is used to build the vast majority of all transistors manufactured today.

![Switch moduels of MOSFETs](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404111050319.png)

### CMOS NOT Gate

As can be seen from the left figure in the image below, if $A = 0$, $N1$ is off and $P1$ is on, so $Y$ is connected to $V_{DD}$, presenting a `上拉(pulled-up)` logic `1`; conversely, when $A = 0$, $Y$ is connected to $GND$, presenting a `下拉(pulled-down)` logic `0`.

![CMOS Gates](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404111055909.png)

### Other CMOS Logic Gates

The middle figure in the image above shows a two-input $NAND$ gate, but I will not elaborate further here.

The rightmost figure shows **the general form used to build any inverting logic gate** (such as $NOT$, $NAND$, or $NOR$).

$nMOS$ transistors are good at passing `0` (how to understand this? When the input is $A=1$, the $n-channel$ in the $nMOS$ forms, and internally it passes `0`), so a pull-down network of $nMOS$ transistors is placed between the output $Y$ and $GND$ to pull the output down to `0`. $pMOS$ transistors are good at passing `1`, so a pull-up network of $pMOS$ transistors is placed between the input $V_{DD}$ and the output $Y$ to pull the output up to `1`. **The networks can be composed of transistors in series or in parallel**.

**If the pull-up network and the pull-down network conduct at the same time**, a `短路(short circuit)` will occur between $V_{DD}$ and $GND$. **Of course, the gate's output may be in the forbidden zone, in which case the transistors dissipate a large amount of power — possibly enough to burn out**.

On the other hand, **if the pull-up network and the pull-down network are both off, the output is connected to neither** $V_{DD}$ **nor** $GND$. **In this case we say the output is** `浮动(floating)`, **and its value is undefined**. Floating outputs are usually undesirable, but later we will also introduce some special cases of floating outputs (occasionally they can even be an advantage — just like your bugs).

**In a properly working logic gate, at any given moment, if one of the networks is** $ON$, **then the other network should be** $OFF$, **so that the output can be pulled high or pulled low rather than short-circuited or floating**. We can guarantee this through the `导通互补规则(the rule of conduction complements)`: **when $nMOS$ transistors are in series, the $pMOS$ transistors must be in parallel; when $nMOS$ transistors are in parallel, the $pMOS$ transistors must be in series**.

### Transmission Gates

Sometimes, designers find it convenient to use an ideal switch that can pass both `0` and `1` well. Recall that $nMOS$ transistors are good at passing `0`, while $pMOS$ transistors are good at passing `1`, so a parallel combination of the two can pass both values well. The left figure in the image below shows such a circuit, called a `传输们(Transimission Gate)` or `通门(pass gate)`. The two sides of the switch are called $A$ and $B$; **because the switch is bidirectional, there is no preferred input or output side. The control signals are called** `使能(enables)`, $EN$ and $\overline{EN}$. **When $EN = 0$ and $\overline {EN} = 1$, both transistors are off. Therefore, the transmission gate is off or disabled, so $A$ and $B$ are not connected. When $EN = 1$ and $\overline{EN} = 0$, the transmission gate is on or enabled, and any logic value can flow between $A$ and $B$**.

![transimission gate and pseudo nMOS](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404111151042.png)

### Pseudo-nMOS Logic

An $N$-input $CMOS$ NOR gate uses $N$ $nMOS$ transistors in parallel and $N$ $pMOS$ transistors in series. In fact, **transistors in series are slower than transistors in parallel, because the resistance of series resistors is greater than that of parallel resistors**. Not only that, **since holes cannot move around the silicon lattice as fast as free electrons, $pMOS$ transistors are also slower than $nMOS$ transistors**. As a result, **parallel $nMOS$ transistors are faster than series $pMOS$ transistors, especially when many transistors are in series**.

Therefore, we introduce `伪-$nMOS$逻辑(pseudo-nMOS logic)`: **replacing the group of slower $pMOS$ transistors with a single** `弱$pMOS$(week $pMOS$)` **transistor that is always on**, as shown in the middle figure of the image above. This $pMOS$ transistor is usually called a `弱上拉(week pulled-up)`. Due to the physical characteristics of the chosen $pMOS$ size, it pulls the output $Y$ up only weakly: **only when none of the $nMOS$ transistors is conducting does this weak pull-up make the output $Y$ produce a logic** `1`. **However, as soon as any $nMOS$ transistor is conducting, it overpowers the weak pull-up and pulls the output $Y$ down to produce a logic** `0`.

The advantage of pseudo-$nMOS$ logic lies in that **it can be used to build fast multi-input NOR gates**, as shown in the right figure of the image above. We will describe more advantages in subsequent notes. Its disadvantage is that **when the output is low, there is a short circuit between $V_{DD}$ and $GND$; both the weak $pMOS$ and the $nMOS$ transistors are conducting, and this short circuit continuously dissipates power, so it should be used with caution**.

> It is worth noting: **pseudo-$nMOS$ logic emerged mainly because $nMOS$ transistors were easier to implement and faster than $pMOS$ transistors in early processes**. In early integrated circuit design, $nMOS$ transistors were easier to manufacture than $pMOS$ transistors, and had higher operating speeds and lower power consumption. Therefore, engineers adopted pseudo-$nMOS$ logic designs to build digital logic circuits. Pseudo-$nMOS$ logic circuits use $nMOS$ transistors as switches, while $pMOS$ transistors are used only for the pull-up operation of the circuit, thereby improving the speed and performance of the circuit.
> **Although the relatively slow speed of $pMOS$ transistors is one factor, it is not the only reason for the emergence of pseudo-$nMOS$ logic**.

## Power Consumption

`功耗(power consumption)` **is the amount of energy consumed per unit time**. **In modern architectures, how to reduce power consumption is a huge challenge, and it also occupies a very important position in digital systems**.

Digital systems consume both `动态功率(dynamic power)` and `静态功率(static power)`. **Dynamic power is the power used to charge capacitance when signals change between** `0` **and** `1`; **static power is the power consumed even when signals do not change or the system is idle**.

Logic gates and the wires connecting them have capacitance. The energy drawn from the power supply to charge a capacitance $C$ to the voltage $V_{DD}$ is $CV_{DD}^2$. If the voltage on the capacitor switches at frequency $f$ (i.e., $f$ times per second), then it charges $f/2$ times and discharges $f/2$ times per second. Discharging does not consume energy from the power supply, so the dynamic power consumption is:

$$
  P_{dynamic} = \frac{1}{2}CV_{DD}^2f
$$

Electronic systems draw some current even when idle. When transistors are off, they leak a small amount of current; for example, the pseudo-$nMOS$ gate discussed in the previous section has a path from $V_{DD}$ to $GND$ through which current flows continuously. The total static current $I_{DD}$ is also called `泄漏电流(leakage current)` or `静态电源电流(quiescent supply current)`, and it flows between $V_{DD}$ and $GND$. Static power consumption is proportional to this static current:

$$
  P_{static} = I_{DD}V_{DD}
$$

## Summary

This note introduced some fundamental principles for understanding and designing complex systems. Logic gates are usually built from $CMOS$ transistors, which behave as electrically controlled switches. An $nMOS$ conducts when its gate is `1`, while a $pMOS$ conducts when its gate is `0`.
