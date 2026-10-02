const getPagination = (
  query,
  { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = {},
) => {
  let page = Number.parseInt(query.page, 10);
  let limit = Number.parseInt(query.limit, 10);

  page = Number.isFinite(page) && page > 0 ? page : defaultPage;
  limit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(limit, maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
};

const paginatedResponse = (items, total, page, limit) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
  },
});

export { getPagination, paginatedResponse };
