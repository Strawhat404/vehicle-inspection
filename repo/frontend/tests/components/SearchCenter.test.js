import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn().mockResolvedValue({ rows: [], total: 0, keywords: [], suggestions: [] })
}));

import SearchCenter from '../../src/components/SearchCenter.vue';
import { apiGet } from '../../src/services/api.js';

beforeEach(() => {
  apiGet.mockResolvedValue({ rows: [], total: 0, keywords: [], suggestions: [] });
});

describe('SearchCenter', () => {
  it('renders all filter labels', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    for (const label of ['Query', 'Brand', 'Energy Type', 'Model Year', 'Price Min', 'Price Max', 'Sort By', 'Sort Order']) {
      expect(wrapper.text()).toContain(label);
    }
  });

  it('has a Search button', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    const searchBtn = wrapper.findAll('button').find(b => b.text().includes('Search'));
    expect(searchBtn).toBeTruthy();
  });

  it('renders results table headers', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    for (const col of ['Brand', 'Model', 'Year', 'Price', 'Energy', 'Transmission']) {
      expect(wrapper.text()).toContain(col);
    }
  });

  it('renders vehicle rows from API response', async () => {
    apiGet.mockResolvedValue({
      rows: [
        {
          id: 1,
          brand: 'Toyota',
          model_name: 'Corolla',
          model_year: 2022,
          price_usd: 18000,
          energy_type: 'petrol',
          transmission: 'auto'
        }
      ],
      total: 1,
      keywords: [],
      suggestions: []
    });
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Toyota');
    expect(wrapper.text()).toContain('Corolla');
  });

  it('shows empty state when no results', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No results found');
  });

  it('has pagination Prev/Next buttons', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Prev');
    expect(wrapper.text()).toContain('Next');
    expect(wrapper.text()).toContain('Page');
  });

  it('calls search API on mount', async () => {
    mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(apiGet).toHaveBeenCalled();
    const call = apiGet.mock.calls.find(c => c[0].includes('/api/search/vehicles'));
    expect(call).toBeTruthy();
  });

  it('displays trending keywords section heading', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Trending Keywords');
  });

  it('shows trending keyword badges when API returns them', async () => {
    apiGet.mockImplementation((path) => {
      if (path.includes('/api/search/trending')) {
        return Promise.resolve({ keywords: [{ keyword: 'Toyota', uses: 5 }] });
      }
      return Promise.resolve({ rows: [], total: 0, keywords: [], suggestions: [] });
    });
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Toyota');
    expect(wrapper.text()).toContain('5');
  });

  it('shows no trending data message when trending list is empty', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No trending data yet.');
  });

  it('Prev button is disabled on first page', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    const prevBtn = wrapper.findAll('button').find(b => b.text().includes('Prev'));
    expect(prevBtn.attributes('disabled')).toBeDefined();
  });

  it('renders multiple vehicle rows', async () => {
    apiGet.mockResolvedValue({
      rows: [
        { id: 1, brand: 'Toyota', model_name: 'Corolla', model_year: 2022, price_usd: 18000, energy_type: 'petrol', transmission: 'automatic' },
        { id: 2, brand: 'Honda', model_name: 'Civic', model_year: 2021, price_usd: 20000, energy_type: 'hybrid', transmission: 'cvt' }
      ],
      total: 2,
      keywords: [],
      suggestions: []
    });
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Toyota');
    expect(wrapper.text()).toContain('Honda');
    expect(wrapper.text()).toContain('petrol');
    expect(wrapper.text()).toContain('hybrid');
  });

  it('renders energy_type values in table rows', async () => {
    apiGet.mockResolvedValue({
      rows: [
        { id: 3, brand: 'Tesla', model_name: 'Model 3', model_year: 2023, price_usd: 40000, energy_type: 'electric', transmission: 'automatic' }
      ],
      total: 1,
      keywords: [],
      suggestions: []
    });
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('electric');
    expect(wrapper.text()).toContain('Tesla');
  });

  it('shows page 1 initially', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Page 1');
  });

  it('Search Intelligence heading is present', async () => {
    const wrapper = mount(SearchCenter, { props: { token: 'test' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Search Intelligence');
  });
});
