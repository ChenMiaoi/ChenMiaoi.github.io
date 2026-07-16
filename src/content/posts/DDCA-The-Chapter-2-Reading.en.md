---
slug: DDCA-The-Chapter-2-Reading.en
title: 'DDCA: The Chapter 2 Reading'
published: 2024-04-11
tags:
  - ysyx
  - digital
  - logic
category: books
series: ddca
lang: "en"
---
In the previous note, we learned some basic principles of digital systems and the fundamental concepts for building and understanding them. This note covers `组合逻辑(Combinational Logic)`, **that is, circuits whose outputs depend only on the current inputs**. The logic gates introduced in the previous note are all examples of combinational logic. **In this note, you will learn to design circuits of multiple gates to implement input-output relationships specified by a** `真值表(truth table)` **or a** `布尔方程(Boolean Equation)`.

## Introduction

In digital electronics, a `电路(circuit)` **is a network that processes discrete-valued variables and can be viewed as a black box**, as shown in the left of the figure below:

- one or more discrete-valued input terminals
- one or more discrete-valued output terminals
- a `功能规范(functional specification)` **describing the relationship between inputs and outputs**
- a `时许规范(timing specification)` **describing the delay between a change in the inputs and the corresponding response of the outputs**

![black box with circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404112329840.png)

A circuit is composed of `节点(node)`s and `元件(element)`s. **An element is itself a circuit with inputs, outputs, and a specification; a node is a wire whose voltage conveys a discrete-valued variable. Nodes are generally classified as input, output, or internal nodes** (**that is, wires with no input or output**). The left of the figure above illustrates a circuit with three elements and six nodes.

Digital circuits are classified as combinational logic circuits or `时序逻辑电路(sequential)` circuits. **The outputs of a combinational circuit depend only on the current values of the inputs; the outputs of a sequential circuit depend on the current and previous values of the inputs (that is, the previous state) — in other words, on the sequence of inputs. Combinational logic is** `无记忆性(memoryless)`, **while sequential logic has** `记忆性(memory)`.

The functional specification of a combinational circuit expresses the output values in terms of the current input values; the timing specification consists of upper and lower bounds on the delay from input to output. We first focus on the functional specification.

The figure below shows a combinational circuit with two inputs and one output. The symbol &#x2104; inside the black box indicates that it is implemented using only combinational logic; in this example it specifically denotes the function $F$ being $OR$: $Y = F(A, B) = A + B$. From the right figure we can also see that **there may be more than one implementation of a single function; given the available building blocks and design constraints, we are free to choose how to design it**.

![combinational logic circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121105178.png)

The next figure shows the multiple-output case; this circuit is called a `全加器(full adder)`. To simplify drawings, we usually use a single line with a slash and a number next to it to represent a bus — a bundle of multiple signals. The number specifies how many signals are in the bus, as shown in the left of the figure below. If the number of bits is unimportant or obvious from the context, the slash may be shown without the number (as in figure b), meaning that an arbitrary number of outputs from one block serve as inputs to the second block.

![multiple-output](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121113083.png)

The rules of `组合构图(combinational composition)` tell us how to construct a large combinational circuit from smaller combinational circuit elements:

- Every circuit element is itself combinational
- Every node of the circuit is either designated as an input of the circuit or connects to exactly one output terminal of a circuit element
- The circuit contains no cyclic paths: **every path through the circuit visits each circuit node at most once**

Large circuits (such as microprocessors) are very complex, so we use the principles from the previous note to manage complexity. **Viewing a circuit as a black box with well-defined interfaces and functions is an application of abstraction and modularity; building circuits from smaller modules is an application of hierarchy; and combinational composition is an application of regularity**.

## Boolean Equations

`布尔方程(Boolean Equations)` deal with variables that are either $TRUE$ or $FALSE$, so they are well suited for describing digital logic. This section defines some terminology commonly used in Boolean equations, then shows how to write a Boolean equation for any logic function from its truth table.

### Terminology

The `补(complement)` of a variable $A$ is denoted $\overline {A}$. A variable or its complement is called a `字面量(literal)`. We also call $A$ the `真正形式(true form)` of the variable and $\overline {A}$ the `补充形式(complementary form)`. **True form does not mean that $A$ is $TRUE$; it merely means that $A$ has no overline**.

The $AND$ of one or more literals is called a `乘积(product)` or an `蕴含项(implicant)`. A `最小项(minterm)` is a product involving all of the inputs to the function; a `最大项(maxterm)` is a sum involving all of the inputs to the function.

### Sum-of-Products Form

A truth table with $N$ inputs contains $2^N$ rows. Each row of a truth table is associated with a minterm, which is the $TRUE$ value for that row. For example, in the left of the figure below, the minterm for the first row is $\overline {AB}$, because $\overline {AB} = TRUE$ when $A = 0, B = 0$. Minterms are numbered starting from 0.

![truth table and minterms](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121212217.png)

**For any truth table, we can write a Boolean equation by summing each of the minterms for which the output $Y = TRUE$**. For example, as circled in blue in the two tables above: $Y_1 = m_1 = \overline {A}B$, $Y_2 = m_1 + m_3 = \overline {A}B + AB$.

Expressions like the above are called the `乘积和规范式(sum-of-products canonical form)` of a function. **This shows that, for a given truth table, we can always write the same Boolean expression** (**that is, the truth table has a unique canonical form**). The sum-of-products canonical form can also be written with the summation symbol $\sum$ in `sigma表示法(sigma notation)`:

$$
    F(A, B) = \sum(m_1, m_3) or F(A, B) = \sum(1, 3)
$$

The sum-of-products canonical form also provides a Boolean equation for a truth table with any number of variables. **Unfortunately, however, the sum-of-products canonical form does not necessarily produce the simplest equation**. Methods for producing minimal equations will be introduced later.

### Product-of-Sums Form

An alternative way to write a Boolean expression is the `和积规范式(product-of-sums canonical form)`. Each row of a truth table is associated with a maxterm, which is the $FALSE$ value for that row. **For any truth table, we can write a Boolean equation by taking the product of each of the maxterms for which the output $Y = FALSE$**. The product-of-sums canonical form can also be written with the product symbol $\Pi$ in `pi表示法(pi notation)`.

**The sum-of-products canonical form produces a shorter equation only when the output is $TRUE$ on a few rows of the truth table; the product-of-sums canonical form is simpler only when the output is $FALSE$ on a few rows**.

## Boolean Algebra

To produce minimal equations, we can simplify Boolean equations using `布尔代数(Boolean Algebra)`. The rules of Boolean algebra are very similar to those of ordinary algebra, and in some cases even simpler.

The axioms and theorems of Boolean algebra all follow the `对偶原则(the principle of duality)`. If the symbols `0` and `1` and the operators $+$ and $\cdot$ can be interchanged and the statement still holds, we may use $\prime$ to mark the dual of a statement.

### Axioms

The table below states the `公理(Axioms)` of Boolean algebra. These five axioms and their duals define Boolean variables and $NOT$, $AND$, and $OR$.

![Axioms of Boolean Algebra](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121254979.png)

### Theorems of One Variable

The table below states the `定理(Theorems)` of Boolean algebra. **These five theorems describe how to simplify equations containing a single variable**.

![Boolean theorems of one variable](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121657502.png)

### Theorems of Several Variables

The table below describes how to simplify expressions involving multiple Boolean variables.

![Boolean theorems of several variables](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121701668.png)

De Morgan's laws lead to some interesting conclusions. If we think of the `反转圈(inversion circle)` as a `气泡(bubble)`, then when you push the "bubbles" at the inputs in the figure below toward the output, the bubbles move to the output and the gate body flips (for example, from $OR$ to $AND$), giving us two different logic-gate symbols that represent the same gate function. However, bubble pushing follows certain rules:

- Pushing a bubble forward or backward (from input to output is forward) changes the gate body from $AND$ to $OR$, and vice versa
- Pushing a bubble back from the output puts a bubble on each input terminal
- **With bubbles on all inputs, pushing a bubble from the inputs toward the output puts a bubble on the output**

![De Morgan equivalent](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404121706989.png)

### Simplifying Equations

The basic principle for simplifying a sum-of-products equation is to combine terms using the relation $PA + P\overline{A} = P$, where $P$ can be any implicant. **We define a sum-of-products equation as** `最小化方程(minimized)` **if it uses the fewest possible implicants**. If several equations have the same number of implicants, the minimal one is the one with the fewest literals.

**If an implicant cannot be combined with any other implicant in the equation to form a new implicant with fewer literals, it is called a** `素蕴含项(prime implicant)`. **All implicants in a minimized equation must be prime implicants**.

![improved equation](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122022122.png)

As shown in the figure above, although it is somewhat counterintuitive ($A\overline{B}C = A\overline{B}C + A\overline{B}\overline{C}$), expanding an implicant is sometimes useful when simplifying a minimized equation. Doing so lets one copy of the duplicated minterm combine with another minterm.

You may have noticed that fully simplifying a Boolean equation using Boolean theorems can be error-prone (that is, the resulting minimization may be incorrect). Later I will introduce another method for simplification, called the Karnaugh map.

## From Logic To Gates

A `原理图(schematic)` is a diagram of a digital circuit, showing the elements and the wires that connect them. For example, a possible hardware implementation of the equation $Y = \overline{A}\overline{B}\overline{C} + A\overline{B}\overline{C} + A\overline{B}C$ is:

![schematic](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122029433.png)

Drawing schematics in a consistent style makes them easier to read and debug. Here are some guidelines:

- Inputs are usually on the left (or top) of a schematic
- Outputs are usually on the right (or bottom) of a schematic
- Whenever possible, gates should flow from left to right
- Straight wires are better than wires with many corners (**jagged wires waste mental effort on tracing wires instead of thinking about the circuit's function**)
- Wires always connect at a $T$ junction
- A dot where wires cross indicates a connection between the wires (no dot means no connection)

![wires form](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122036060.png)

Any Boolean equation in sum-of-products canonical form can be drawn as a schematic in a systematic way. A `可编辑逻辑阵列(Programmable Logic Array，PLA)` is a digital circuit containing a set of programmable logic gates that allow users to configure logic functions for specific needs. A $PLA$ usually consists of a programmable array of $AND$ gates together with a programmable array of $OR$ gates. By programming the connections and inputs of these gates, various logic functions can be implemented to build customized digital circuits.

We can use inverters to further reduce the number of gates. For example, in the figure below, $\overline{B}\overline{C}$ is an AND gate with inverted inputs. Recalling De Morgan's laws, an AND gate with inverted inputs is equivalent to a NOR gate. Depending on the implementation technology, it may be cheaper to use the fewest gates or to prefer certain types of gates, giving us another opportunity for optimization.

![optimization gate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122045848.png)

Many circuits have multiple outputs, each of which is related to the inputs by a separate Boolean function. We could write a separate truth table for each output, but it is often much more convenient to write all the outputs on a single truth table and draw a single schematic with all the outputs. For example, drawing a four-input priority circuit:

- $Y_3$ can be $TRUE$ only when $A_3$ is asserted, so $Y_3 = A_3$
- $Y_2$ can be $TRUE$ only when $A_2$ is asserted and $A_3$ is not, so $Y_2 = \overline{A_3}A_2$
- And so on... $Y_1 = \overline{A_3}\overline{A_2}A_1$, $Y_0 = \overline{A_3}\overline{A_2}\overline{A_1}A_0$
- Then write the truth table for the four outputs
- Draw the corresponding circuit

![priority circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122100899.png)

Note that when $A_3$ is asserted, **the priority circuit's outputs don't care what the other inputs are**. We therefore use $X$ to describe input values that the output does not care about. We can then simplify the truth table, as shown in the figure above.

### Multilevel Combinational Logic

Logic in sum-of-products canonical form is called `二级逻辑(two-level logic)` because it consists of literals connected to one level of AND gates and one level of OR gates. In practice, we usually design circuits with multilevel combinational logic because it may use fewer elements.

### Hardware Reduction

Now consider the XOR gate we have learned. Suppose we want to build a three-input XOR gate using two-level logic.

Recall the $N$-input XOR gate: **the output is** $TRUE$ **when an odd number of inputs are** $TRUE$. Its expression is therefore: $Y = \overline {A}\overline {B}C + \overline {A}B\overline {C} + A\overline {B}\overline {C} + ABC$. We find that **this expression cannot be simplified any further**.

On the other hand, $A \oplus B \oplus C = (A \oplus B) \oplus C$, so a three-input XOR can be built by cascading two-input XOR gates.

Generalizing this, you will find that **cascading two-input XOR gates to build a multi-input XOR is an excellent approach**: if you needed an eight-input XOR, you would need a 128-input OR gate and 128 eight-input AND gates. However, **choosing the best multilevel implementation of a particular logic function is not a simple process**.

### Bubble Pushing

$CMOS$ technology favors NAND and NOR gates (over AND and OR gates). However, **working out an equation by inspecting a multilevel circuit built with NAND and NOR gates is quite tricky**. Bubble pushing helps redraw these circuits so that the bubbles cancel and the function becomes easier to determine.

- Start at the output of the circuit and work toward the inputs
- **Push any bubble on the final output back, so that you can read the equation in terms of the output** (**that is,** $Y$ **rather than** $\overline {Y}$)
- Working backward, draw each gate in a form such that the bubbles cancel:
  - **If the current gate has an input bubble, the preceding gate (note: "preceding" in the right-to-left direction) should have an output bubble**
  - **If the current gate has an output bubble, the following gate should have an input bubble**

![bubble-pushed circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122142430.png)

Finally, it is worth emphasizing that **because bubbles in series cancel each other**, we can ignore the bubbles on the outputs of the middle gates and on one input of the rightmost gate, giving:

![Logically equivalent bubble-pushed circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122146980.png)

## X's and Z's, Oh My

Although Boolean algebra is limited to `0` and `1`, real circuits can have illegal and floating values, represented by $X$ and $Z$ respectively.

### Illegal Value: X

The symbol $X$ indicates that a circuit node has an `未知的(unknown)` or `非法的(illegal)` value. This usually happens when the node is driven to both `0` and `1` at the same time, a situation called `竞争(contention)`. Contention is considered an error and must be avoided. When contention occurs, the voltage of the node usually falls somewhere in $0 \thicksim V_{DD}$, most often in the forbidden zone. Contention causes a large amount of current to flow through the conflicting gates, heating up and potentially damaging the circuit.

$X$ values are also commonly used for uninitialized values in circuit simulation. Recall, however, that $X$ also appears in truth tables, as we saw earlier; that $X$ is different from these two cases — it merely means the value can be ignored.

### Floating Value: Z

The symbol $Z$ indicates that a node is driven neither HIGH nor LOW, so it is called `浮动(floating)`, `高阻抗(high impedance)`, or `高Z(high Z)`. **A classic mistake is to assume that a floating or undriven node has the same logic value as** `0`; **in fact, a floating node may be** `0`, **may be** `1`, **or may be at some voltage in between, depending on the system**. Also note: **a floating node does not always indicate an error; the circuit may still perform its function correctly**.

A common way to produce a floating node is **forgetting to connect a voltage to an input, or assuming that an unconnected input behaves the same as an input with the value** `0`. **This mistake can cause the circuit to behave erratically as the floating value randomly changes in the** $0 \thicksim 1$ **range**.

![tristate buffer](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122210693.png)

A `三态缓冲器(tristate buffer)` has three possible output states: `HIGH(1)`, `LOW(0)`, and `floating(Z)`. The output of a tristate buffer changes with the state of the enable $E$. Tristate buffers are commonly used to connect multiple chips on a bus.

For example, the microprocessor, video controller, and Ethernet controller all need to communicate with the memory system in a computer; each chip can connect to a shared memory bus through a tristate buffer. **The shared bus can only communicate with one controller at a time, so the other controllers must enter the floating output state to avoid interfering with the one communicating**. In modern computers, however, **point-to-point links achieve higher communication speeds: chips connect directly to each other instead of sharing a bus**.

## Karnaugh Maps

After minimizing Boolean equations with Boolean algebra a few times, you will realize that one careless step can leave you with a completely different equation instead of a simplified one. Therefore, `卡诺图(Karnaugh maps, K-maps)` provide a graphical method for simplifying Boolean equations. **Karnaugh maps work well for problems with up to four variables**.

Recall that logic minimization involves combining terms: **two terms containing an implicant $P$ are combined with the true and complementary forms of some variable $A$ to eliminate** $A$, i.e., $PA + P\overline{A} = P$. Karnaugh maps present this graphically.

The figure below shows the truth table and the K-map. The top row of the K-map gives the four possible values of the inputs $AB$, and the left column gives the two possible values of the input $C$. Each square corresponds to a row of the truth table and contains the value of the output $Y$ for that row. Figure (c) shows the minterm corresponding to each square in the K-map.

Each cell (or minterm) differs from an adjacent cell by a change in a single variable, **meaning that adjacent cells share all the same literals except one (that is, $\overline{A}\overline{B}\overline{C} \longrightarrow \overline{A}B\overline{C}$, $\overline{A}\overline{B}\overline{C} \longrightarrow \overline{A}\overline{B}C$, and so on)**. You may have noticed that **the values of $AB$ across the top are in a special order: $00,\ 01,\ 11,\ 10$, which differs from normal binary counting order**; it is the `格雷码(Gray code)`. In other words, **adjacent entries differ by only a single value — multiple values never change at once**.

K-maps "wrap around": **the rightmost column is effectively adjacent to the leftmost column (again a single-variable change). In other words, the K-map can be rolled into a cylinder with its ends joined into a torus, and the property still holds**.

![Three-input function](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122315476.png)

### Circular Thinking

In the figure above there are only two minterms, and reading the minterms from the K-map happens to be equivalent to reading the sum-of-products canonical form directly from the truth table.

Earlier, we obtained the minimization using Boolean algebra:

$$
    Y = \overline{A}\overline{B}\overline{C} + \overline{A}\overline{B}C = \overline{A}\overline{B}(\overline{C} + C) = \overline {AB}
$$

Now, the K-map helps us simplify graphically by circling neighboring cells whose value is `1`.

For each circle, we write the corresponding implicant (recall that **an implicant is a combination of one or more literals**). But remember: **variables whose true and complementary forms are both inside the circle are excluded from the implicant**.

![K-maps minization](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404122337073.png)

### Logic Minimization with K-Maps

K-maps provide an easy visual way to obtain a minimized equation: simply circle all the cells with value `1` in the map using as few circles as possible. More formally, **a Boolean equation is minimized when it is written as a sum of the fewest prime implicants; therefore each circle on a K-map represents an implicant, and the largest possible circles are prime implicants**.

Here are the rules for finding a minimized equation from a K-map:

- Use the fewest circles necessary to cover all the `1`s
- All the cells in each circle must contain `1`s
- Each circle must span a rectangular block (the block must consist of $1、2、4$ squares)
- Each circle must be as large as possible
- Circles must stay within the boundaries of the K-map
- A `1` in a K-map may be circled multiple times if doing so allows fewer circles

> A seven-segment display decoder takes a four-bit data input $D_{3:0}$ and produces seven outputs to control light-emitting diodes that display the digits 0 through 9. These seven outputs are typically called segments $a$ through $g$, or $S_a–S_g$, as defined in the figure below. The digits are shown in the figure. Write a truth table for the outputs, and use Karnaugh maps to find Boolean equations for $S_a$ and $S_b$. Assume that illegal input values $(10–15)$ produce a blank output.

![Seven-digit truth table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404130024444.png)

The truth table for $S_a - S_g$ is shown in the figure above, and the K-maps for $S_a$ and $S_b$ are shown below. We then circle as many adjacent `1`s as possible according to the K-map rules, giving the K-maps at the bottom.

![K-Map solution](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404130024417.png)

Note: **the minimized set of prime implicants is not unique**. For example, in the K-map for $S_a$, the $0000$ term can be combined with the $1000$ term to produce $\overline{D_2}\overline{D_1}\overline{D_0}$, or with the $0010$ term to produce $\overline{D_3}\overline{D_2}\overline{D_0}$.

![alternative K-maps for Sa](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131255374.png)

Note the right figure above: **it illustrates a common mistake — choosing a non-prime implicant in the upper-left corner to cover a** `1`. The minterm $\overline{D_3}\overline{D_2}\overline{D_1}\overline{D_0}$ gives a sum-of-products equation that is not minimized. This minterm can be combined with any of its neighbors to form a larger circle.

### Don't Cares

Recall the $X$ we learned about earlier, where an input of the truth table is not cared about by the output. The concept can also appear in a truth table where an output is not cared about by the inputs. **In a K-map, an $X$ therefore allows further logic minimization; if circling it does not help a circle, it can be ignored**.

![K-Maps with don't cares](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131307082.png)

### The Big Picture

Both Karnaugh maps and Boolean algebra aim to **find a low-cost way to implement a particular logic function**. In modern engineering practice, however, **computer programs called logic synthesizers can generate minimal circuits from a description of a logic function, so for large problems a logic synthesizer is preferable**. We will study this later.

## Combinational Building Blocks

**Combinational logic is often grouped into larger blocks to build more complex systems. This is an application of the abstraction principle, hiding unnecessary gate-level details to emphasize the function of the building block**. This section introduces the `多路复用器(multiplexer)` and `解码器(decoders)`.

### Multiplexer

The `多路复用器(Multiplexer)` is the most commonly used combinational circuit. **It chooses one output from among several possible inputs, based on the value of a select signal**. A multiplexer is also called a `mux`.

#### 2:1 Multiplexer

The figure below shows the schematic and truth table of a `2:1多路复用器`. It has two inputs $D_0$ and $D_1$, a select input $S$, and one output $Y$. It follows: when $S=0$, $Y=D_0$; otherwise $Y=D_1$. $S$ is also called the `控制信号(control signal)`.

The right figure shows the K-map and logic circuit of the `2:1多路复用器`. Of course, there is another way to build a multiplexer: using tristate buffers. **With tristate buffers, only one buffer is active at any time; when $S = 0$ the tristate $T_0$ is activated, otherwise $T_1$ is activated — achieving the same function**.

![2:1 Multiplexer](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131428215.png)

#### Wider Multiplexer

The figure below shows a `4:1多路复用器`. As we can see, a multiplexer can be built in three ways: with AND gates, with tristate buffers, or by cascading multiplexers. We can also see that for a larger multiplexer, the number of control signals is $\log_2N$, and the same three approaches still apply.

![4:1 Multiplexer](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131431612.png)

#### Multiplexer Logic

**Multiplexers can be used as** `查找表(lookup tables)` **to implement logic functions**.

The figure below uses a `4:1多路复用器` to implement a two-input AND gate. **In fact, any $N$-input logic function can be implemented with a $2^N$-input multiplexer**. **The method is: write the truth table of the logic function, connect the multiplexer inputs according to the values in the truth table, and use the corresponding inputs as the multiplexer's control signals to look up the table**.

![multiplexer logic implement](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131443021.png)

### Decoders

A `解码器(decoder)` has $N$ inputs and $2^N$ outputs. **Each output depends on the combination of the inputs**. The figure below shows the logic of a `2:4解码器`. Its outputs are called `独热(one-hot)` because, under given conditions, exactly one output is `hot(HIGH)` at a time.

> The two terms 解码器 and 译码器 are equivalent — both mean "decoder".

**Each output of a decoder depends on the true or complementary form of all the inputs. In short, an $N:2^N$ decoder can be built from $2^N$ AND gates that accept the various combinations of $TRUE$ or $FALSE$ values of all the inputs**. **Each output of a decoder represents a minterm**.

![Decoder implement](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131454667.png)

#### Decoder Logic

**A decoder can be combined with OR gates to build logic functions**. As shown in the figure above, a `2:4译码器` together with a two-input OR gate builds a two-input XNOR gate: $Y = AB + \overline{AB} = \overline {A \oplus B}$.

**When using a decoder to build a logic circuit, it is easy to express the function as a truth table or in sum-of-products canonical form. An $N$-input function with** $M$ `1`s **in its truth table can be built from an $N:2^N$ decoder and an $M$-input OR gate connecting all the minterms whose output is** `1`. This will be used later in read-only memory.

> This may look rather obscure, so here is a small example:
> Suppose you need to implement a two-input AND gate. We already know its truth table has one output equal to `1`. So choose a `2:4译码器` and a one-input OR gate (that is, a two-input OR gate with one input permanently `0`). From the truth table of a two-input AND gate, the output is `1` only when both inputs are `1`, so we select `Y_3` of the `2:4译码器` and connect all the minterms, giving the equation $Y = Y_3 + 0 = AB + 0 = AB$.
> This yields an implementation of a two-input AND gate using a `2:4译码器` and a one-input OR gate.

## Timing

In the previous sections, we focused mainly on **how a circuit works under ideal conditions, using the fewest gates**. In practice, **one of the most challenging problems in circuit design is timing: how to make the circuit run faster**.

**An output takes time to respond to a change in the input**. The figure below shows the `延迟(delay)` between a change in a buffer's input and the subsequent change in its output. Such a diagram is called a $时序图(timing diagram)$; **it depicts the** `瞬态响应(transient response)` **of the buffer circuit when the input changes**. A transition from $LOW$ to $HIGH$ is called a `上升沿(rising edge)`, and naturally a transition from $HIGH$ to $LOW$ is called a $下降沿(falling edge)$. The blue arrow indicates that the rising edge of $Y$ is caused by the rising edge of $A$. **We measure the delay between the $50\%$ point of the input signal $A$ and the $50\%$ point of the output signal $Y$**. The `50%点(50% point)` **is the point at which the signal's voltage is** `中间点(half-way)` **between HIGH and LOW during a transition**.

![Circuit delay](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131523810.png)

### Propagation amd Contamination Delay

The timing characteristics of a combinational circuit are the `传播延时(Propagation Delay)` and the `污染延时(Contamination Delay)`. The propagation delay $t_{pd}$ **is the maximum time from when an input changes until the output or outputs reach their final value**; the contamination delay $t_{cd}$ **is the minimum time from when an input changes until an output starts to change its value**.

As shown in the figure above, the propagation delay and contamination delay of the buffer are indicated in blue and gray respectively. The figure shows that $A$ is initially either $HIGH$ or $LOW$ and changes to the other state at a particular time; we do not care about its value, only that it changed. $Y$ responds some time after $A$ changes. The arcs indicate that $Y$ may start to respond $t_{cd}$ after $A$ transitions and will settle to its new value within $t_{pd}$.

The underlying causes of circuit delay include **the time required to charge capacitance in the circuit and the propagation of electrical signals at the speed of light**. For these reasons, $t_{cd}$ and $t_{pd}$ may differ because of:

- Different rising and falling delays
- Delays may differ between multiple inputs and outputs
- Circuits speed up when cold and slow down when hot

Computing $t_{cd}$ and $t_{pd}$ accurately and in detail requires descending to a lower level of abstraction, which is beyond our scope. However, **manufacturers usually provide datasheets specifying the delays of each gate**.

As mentioned earlier, **propagation and contamination delays are also determined by the path a signal takes from input to output**.

The figure below shows a four-input logic circuit. The `关键路径(critical path)` is shown in blue: **it is the longest — and therefore slowest — path, because the input passes through three gates before reaching the output. This path is critical because it limits the speed at which the circuit can run**. The `最短路径(short path)` is shown in gray: **it passes through only one gate from input to output, so it is the shortest — and fastest — path**.

![Critical and short path waveforms](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131633513.png)

**The propagation delay of a combinational circuit is the sum of the propagation delays of each element on the critical path**. **The contamination delay is the sum of the minimum delays of each element on the short path**. For example, the delays in the figure above are:

$$
    t_{pd} = 2t_{pd_AND} + t_{pd_OR}
$$

$$
    t_{cd} = t_{cd_AND}
$$

### Glitches

So far, we have only discussed the case where a single input transition causes a single output transition. **However, a single input transition may cause multiple output transitions**; this is called a `毛刺(glitches)` or a `危险(hazards)`. **Although a glitch usually does not cause problems, it is important to be aware of their existence and to recognize them when looking at timing diagrams**.

![Circuits with a glitch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131645691.png)

The figure above shows the K-map and the circuit of a circuit with a glitch. The short path (in gray) passes through two gates — an AND gate and an OR gate. The critical path (in blue) passes through three gates — a NOT gate, an AND gate, and an OR gate. When $B$ transitions from `1` to `0`, $n2$ (on the short path) falls before $n1$ (on the critical path). Until $n1$ rises, both inputs of the OR gate are `0`, causing the output $Y$ to drop to `0`. When $n1$ finally rises, $Y$ returns to `1`. The figure also shows the timing diagram for this situation: $Y$ starts at `1` and ends at `1`, but momentarily glitches to `0` in between.

Therefore, **as long as we wait as long as the propagation delay before reading the output, glitches are not a problem, because the output will eventually settle to the correct value**.

**Adding another gate can prevent such a glitch**. The K-map in the figure below explains the problem: the transition from $ABC = 001 \longrightarrow ABC = 011$ is exactly the transition of $B$ described above, which produced a glitch. Therefore, **a transition in a K-map that crosses the boundary between two prime implicants indicates a possible glitch**.

As the timing diagram above shows, **a glitch occurs when the circuit for one prime implicant turns off before the circuit for another prime implicant turns on**. To remove the glitch, **we can add a new circle covering the edge between the implicants; by the consensus theorem, the added term $\overline{A}C$ is the consensus, i.e., redundant**.

![Circuit without glitch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131703043.png)

The figure above shows a glitch-free circuit. An AND gate has been added (highlighted in blue); now the transition of $B$ no longer causes a glitch on the output, because this AND gate outputs `1` throughout the transition.

**In summary, when a transition of a single variable crosses the boundary between two prime implicants in a K-map, we can eliminate the glitch by adding a redundant implicant to the K-map**. **However, this comes at the cost of extra hardware**.

**However, simultaneous transitions on multiple inputs can also cause glitches, and these glitches cannot be fixed by adding hardware**. **Since the vast majority of "interesting" systems have multiple inputs transitioning at (or nearly at) the same time, "glitches are a part of life" in most circuits**. Although we have shown how to eliminate one kind of glitch, **the point of discussing glitches is not to eliminate them, but to be aware of their existence. This is especially important when looking at timing diagrams on a simulator or an oscilloscope**.

## Summary

**A digital circuit is a module with discrete-voltage-valued inputs and outputs. Its specification describes the function the module implements and its timing. In this chapter we focused on combinational circuits, whose outputs depend only on the current values of the inputs**.

**The next chapter introduces sequential circuits, whose outputs depend on previous as well as current inputs. In other words, sequential circuits have memory of the past state**.
