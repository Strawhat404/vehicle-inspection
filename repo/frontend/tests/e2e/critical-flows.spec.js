import { test, expect } from '@playwright/test';

// These tests require a running Docker environment with real backend + frontend
// Run with: npx playwright test --config playwright.config.js

test.describe('Login Flow', () => {
  test('admin can log in via the login form and see the dashboard', async ({ page }) => {
    await page.goto('/');

    // Login form should be visible
    await expect(page.getByText('RoadSafe Inspection Operations')).toBeVisible();

    // Fill login form
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('Admin@123456');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Dashboard should load
    await expect(page.getByText('Operations Menu')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Administrator')).toBeVisible();
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('WrongPassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error message should appear
    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Coordinator Scheduling Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin first (coordinator may not exist yet)
    await page.goto('/');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('Admin@123456');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Operations Menu')).toBeVisible({ timeout: 10000 });
  });

  test('admin can navigate to coordinator scheduling view', async ({ page }) => {
    // Click Coordinator menu item
    await page.getByRole('button', { name: 'Coordinator' }).click();

    // Coordinator scheduling form should appear
    await expect(page.getByText('Coordinator Scheduling')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Customer ID')).toBeVisible();
    await expect(page.getByText('Vehicle Type')).toBeVisible();
    await expect(page.getByText('Create Appointment')).toBeVisible();
  });

  test('admin can navigate to search view', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Search Intelligence')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Brand')).toBeVisible();
  });
});

test.describe('Dashboard Metrics', () => {
  test('admin sees metric cards after login', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('Admin@123456');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Operations Menu')).toBeVisible({ timeout: 10000 });

    // Dashboard metric cards
    await expect(page.getByText("Today's Appointments")).toBeVisible();
    await expect(page.getByText('Total Inspections')).toBeVisible();
    await expect(page.getByText('Active Resources')).toBeVisible();
  });
});

test.describe('Logout Flow', () => {
  test('user can log out and return to login form', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('Admin@123456');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Operations Menu')).toBeVisible({ timeout: 10000 });

    // Click Sign Out
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Should return to login
    await expect(page.getByText('Sign In')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Operations Menu')).not.toBeVisible();
  });
});
