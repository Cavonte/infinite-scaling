import org.junit.jupiter.api.Test
import kotlin.test.*

// The task:
// 1. Read and understand the Hierarchy data structure described in this file.
// 2. Implement filter() function.
// 3. Implement more test cases.
//
// The task should take 30-90 minutes.
//
// When assessing the submission, we will pay attention to:
// - correctness, efficiency, and clarity of the code;
// - the test cases.

/**
 * A `Hierarchy` stores an arbitrary _forest_ (an ordered collection of ordered trees)
 * as an array of node IDs in the order of DFS traversal, combined with a parallel array of node depths.
 *
 * Parent-child relationships are identified by the position in the array and the associated depth.
 * Each tree root has depth 0, its children have depth 1 and follow it in the array, their children have depth 2 and follow them, etc.
 *
 * Example:
 * ```
 * nodeIds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
 * depths:  0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2
 * ```
 *
 * the forest can be visualized as follows:
 * ```
 * 1
 * - 2
 * - - 3
 * - - - 4
 * - 5
 * 6
 * - 7
 * 8
 * - 9
 * - 10
 * - - 11
 *```
 * 1 is a parent of 2 and 5, 2 is a parent of 3, etc. Note that depth is equal to the number of hyphens for each node.
 *
 * Invariants on the depths array:
 *  * Depth of the first element is 0.
 *  * If the depth of a node is `D`, the depth of the next node in the array can be:
 *      * `D + 1` if the next node is a child of this node;
 *      * `D` if the next node is a sibling of this node;
 *      * `d < D` - in this case the next node is not related to this node.
 */
interface Hierarchy {
  /** The number of nodes in the hierarchy. */
  val size: Int

  /**
   * Returns the unique ID of the node identified by the hierarchy index. The depth for this node will be `depth(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun nodeId(index: Int): Int

  /**
   * Returns the depth of the node identified by the hierarchy index. The unique ID for this node will be `nodeId(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun depth(index: Int): Int

  fun formatString(): String {
    return (0 until size).joinToString(
      separator = ", ",
      prefix = "[",
      postfix = "]"
    ) { i -> "${nodeId(i)}:${depth(i)}" }
  }
}

/**
 * A node is present in the filtered hierarchy iff its node ID passes the predicate and all of its ancestors pass it as well.
 */
fun Hierarchy.filter(nodeIdPredicate: (Int) -> Boolean): Hierarchy {

  var index = 0
  var trimLevel = -1
  val outputIds = mutableListOf<Int>()
  val outputDepthIds = mutableListOf<Int>()

  while (index < size) {
    val node = nodeId(index)
    val depth = depth(index)
    if (!nodeIdPredicate(node)) {
      // Node does not pass predicate. Do not put in output list
      // iterate while depth > to current depth, thereby trimming the entire branch
      trimLevel = depth
      while (index + 1 < size && depth(index + 1) > trimLevel)
        index++
    } else {
      // predicate is true, append node and depth to output
      outputIds.add(node)
      outputDepthIds.add(depth)
    }
    index++
  }

  // Complexity: This is done in single pass, so O(n) where n is the size of the input.
  // Space Complexity: O(2 * N) -> O(N) to store ids and depth
  return ArrayBasedHierarchy(outputIds.toIntArray(), outputDepthIds.toIntArray())
}

class ArrayBasedHierarchy(
  private val myNodeIds: IntArray,
    private val myDepths: IntArray,
) : Hierarchy {
  override val size: Int = myDepths.size

  override fun nodeId(index: Int): Int = myNodeIds[index]

  override fun depth(index: Int): Int = myDepths[index]
}

class FilterTest {
  // Kept original test for ref.
  @Test
  fun testFilter() {
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11), intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 5, 8, 10, 11), intArrayOf(0, 1, 1, 0, 1, 2)
    )

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  @Test
  fun `given a tree with a failing root should trim the entire tree`() {
    // Root node 3 fails the predicate, so its entire subtree must be excluded
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(3, 1, 2), intArrayOf(0, 1, 2)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(intArrayOf(), intArrayOf())

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  @Test
  fun `given a valid tree nodes should remain untouched`() {
    // No node fails the predicate, output should equal input
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 4), intArrayOf(0, 1, 2)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }

    assertEquals(unfiltered.formatString(), filteredActual.formatString())
  }

  @Test
  fun `given an input with multiple roots only failing roots and branches should be trimmed`() {
    // Root 1 (depth 0) -> child 2 (depth 1)
    // Root 3 (depth 0) -> children 4, 5 -> Root 3 fails, so 3, 4, 5 are all excluded
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5), intArrayOf(0, 1, 0, 1, 1)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2), intArrayOf(0, 1)
    )

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  @Test
  fun `given a tree with many nodes on the same level only failing nodes are removed`() {
    // Root 1 (depth 0) -> siblings 2, 3, 4, 5 (all depth 1)
    // Sibling 3 fails; its siblings 2, 4, 5 are unaffected
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5), intArrayOf(0, 1, 1, 1, 1)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 4, 5), intArrayOf(0, 1, 1, 1)
    )

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  @Test
  fun `given an empty hierarchy filter should return an empty hierarchy`() {
    val unfiltered: Hierarchy = ArrayBasedHierarchy(intArrayOf(), intArrayOf())
    val filteredActual: Hierarchy = unfiltered.filter { true }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(intArrayOf(), intArrayOf())

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  // Similar coverage as the original test
  @Test
  fun `given a failing intermediate node its subtree should be trimmed while passing siblings and their children survive`() {
    // Root 1 (depth 0)
    //   ├── child 3 (depth 1, fails), 4 and 3 should be removed
    //   └── child 2 (depth 1, passes), 2 and 5 should pass
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 3, 4, 2, 5), intArrayOf(0, 1, 2, 1, 2)
    )
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 5), intArrayOf(0, 1, 2)
    )

    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }
}
