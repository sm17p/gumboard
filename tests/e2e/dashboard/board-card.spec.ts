import { test, expect } from "../../fixtures/test-helpers";

test.describe("Board Card", () => {
  test("should exclude archived notes from the board card", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    // create a board
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Test Board 1"),
        description: testContext.prefix("A test board 1"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    // create 2 notes and archive one of them
    await testPrisma.note.createMany({
      data: [
        {
          color: "#fef3c7",
          archivedAt: null,
          createdBy: testContext.userId,
          boardId: board.id,
        },
        {
          color: "#fef3c7",
          archivedAt: new Date().toISOString(),
          createdBy: testContext.userId,
          boardId: board.id,
        },
      ],
    });

    // get the new board
    const boards = await testPrisma.board.findFirst({
      where: {
        id: board.id,
        organizationId: testContext.organizationId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            notes: {
              where: {
                deletedAt: null,
                archivedAt: null,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // assert that the notes count is 1
    expect(boards?._count.notes).toBe(1);

    // go to dashboard
    await authenticatedPage.goto("/dashboard");

    // go to card header then search for span that contain notes count
    await expect(
      authenticatedPage.locator(`[href="/boards/archive"]`).getByLabel("Notes Count")
    ).toHaveText("1 note");
    await expect(
      authenticatedPage.locator(`[href="/boards/${board.id}"]`).getByLabel("Notes Count")
    ).toHaveText("1 note");
  });

  test("should display 'No activity' state for All Notes and Archive cards when no notes exist", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Empty Board for No Activity Test"),
        description: testContext.prefix("Board with no notes for testing"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    const allNotesCard = authenticatedPage.locator('a[href="/boards/all-notes"]');
    await expect(allNotesCard).toBeVisible({ timeout: 10000 });
    await expect(allNotesCard).toContainText("No activity");

    const archiveCard = authenticatedPage.locator('a[href="/boards/archive"]');
    await expect(archiveCard).toBeVisible({ timeout: 10000 });
    await expect(archiveCard).toContainText("No activity");
  });

  test("should display activity time for All Notes card when notes exist", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("All Notes Activity Test"),
        description: testContext.prefix("Testing all notes activity display"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await testPrisma.note.create({
      data: {
        color: "#fef3c7",
        boardId: board.id,
        createdBy: testContext.userId,
        checklistItems: {
          create: [
            {
              content: testContext.prefix("All notes test task"),
              checked: false,
              order: 0,
            },
          ],
        },
      },
    });

    await authenticatedPage.goto("/dashboard");

    const allNotesCard = authenticatedPage.locator('a[href="/boards/all-notes"]');
    await expect(allNotesCard).toBeVisible({ timeout: 10000 });

    const cardText = await allNotesCard.textContent();
    expect(cardText).toContain("Just now");
    expect(cardText).not.toContain("No activity");
  });

  test("should display activity time for Archive card when archived notes exist", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Archive Activity Test"),
        description: testContext.prefix("Testing archive activity display"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    // Create and archive a note to generate archive activity
    await testPrisma.note.create({
      data: {
        color: "#fef3c7",
        boardId: board.id,
        createdBy: testContext.userId,
        archivedAt: new Date(),
        checklistItems: {
          create: [
            {
              content: testContext.prefix("Archived test task"),
              checked: false,
              order: 0,
            },
          ],
        },
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify Archive card shows activity time
    const archiveCard = authenticatedPage.locator('a[href="/boards/archive"]');
    await expect(archiveCard).toBeVisible({ timeout: 10000 });

    const cardText = await archiveCard.textContent();
    expect(cardText).toContain("Just now");
    expect(cardText).not.toContain("No activity");
  });

  test("should display correct UI states for private and public board cards", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const privateBoard = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Empty Private Board"),
        description: testContext.prefix("Private board with no notes"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
        isPublic: false,
      },
    });

    const publicBoard = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Multi Note Public Board"),
        description: testContext.prefix("Public board with multiple notes"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
        isPublic: true,
      },
    });

    for (let i = 0; i < 3; i++) {
      await testPrisma.note.create({
        data: {
          color: "#fef3c7",
          boardId: publicBoard.id,
          createdBy: testContext.userId,
          checklistItems: {
            create: [
              {
                content: testContext.prefix(`Task ${i + 1}`),
                checked: false,
                order: 0,
              },
            ],
          },
        },
      });
    }

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Test private board card
    const privateBoardCard = authenticatedPage.locator(`[data-board-id="${privateBoard.id}"]`);
    await expect(privateBoardCard).toBeVisible({ timeout: 10000 });

    // Test public board card
    const publicBoardCard = authenticatedPage.locator(`[data-board-id="${publicBoard.id}"]`);
    await expect(publicBoardCard).toBeVisible({ timeout: 10000 });

    // Test Board Visibility indicators - conditional logic
    await expect(privateBoardCard.getByLabel("Board Visibility")).toBeVisible();
    await expect(privateBoardCard.getByLabel("Board Visibility")).toContainText("Private");

    await expect(publicBoardCard.getByLabel("Board Visibility")).toBeVisible();
    await expect(publicBoardCard.getByLabel("Board Visibility")).toContainText("Public");

    // Verify both cards show activity time
    const privateBoardText = await privateBoardCard.textContent();
    expect(privateBoardText).toContain("Just now");

    const publicBoardText = await publicBoardCard.textContent();
    expect(publicBoardText).toContain("Just now");
  });

  test("should display last activity on dashboard boards", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Activity Test"),
        description: testContext.prefix("Testing activity display"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    const boardCard = authenticatedPage.locator(`[data-board-id="${board.id}"]`);
    await expect(boardCard).toBeVisible({ timeout: 10000 });

    const boardText = await boardCard.textContent();
    expect(boardText).toContain("Just now");
  });

  test("should show enhanced time formatting with hours and minutes", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Time Format Test"),
        description: testContext.prefix("Testing enhanced time formatting"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    const pastTime = new Date(Date.now() - 1.5 * 60 * 60 * 1000);
    await testPrisma.note.create({
      data: {
        color: "#fef3c7",
        boardId: board.id,
        createdBy: testContext.userId,
        updatedAt: pastTime,
        checklistItems: {
          create: [
            {
              content: testContext.prefix("Old task"),
              checked: false,
              order: 0,
              updatedAt: pastTime,
            },
          ],
        },
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    const boardCard = authenticatedPage.locator(`[data-board-id="${board.id}"]`);
    await expect(boardCard).toBeVisible({ timeout: 10000 });

    const boardText = await boardCard.textContent();
    expect(boardText).toContain("1h 30m ago");
  });

  test("should handle empty boards correctly", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Empty Board"),
        description: testContext.prefix("Board with no notes"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    const boardCard = authenticatedPage.locator(`[data-board-id="${board.id}"]`);
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await expect(boardCard).toContainText("0 notes");

    const boardText = await boardCard.textContent();
    expect(boardText).toContain("Just now");
  });

  test("should update activity when note is created via API", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("API Activity Test"),
        description: testContext.prefix("Testing API activity updates"),
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await testPrisma.note.create({
      data: {
        color: "#fef3c7",
        boardId: board.id,
        createdBy: testContext.userId,
        checklistItems: {
          create: [
            {
              content: testContext.prefix("Recent task"),
              checked: false,
              order: 0,
            },
          ],
        },
      },
    });

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    const boardCard = authenticatedPage.locator(`[data-board-id="${board.id}"]`);
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await expect(boardCard).toContainText("1 note");

    const boardText = await boardCard.textContent();
    expect(boardText).toContain("Just now");
  });
});
