import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../lib/apiClient";
import { getMenuCatalogApi, updateMenuItemImageApi } from "../lib/api/menuApi";

function getSuggestedImageUrl(item) {
  return `https://loremflickr.com/900/700/${encodeURIComponent(`${item.name} food dish`)}`;
}

export default function MenuImageManager() {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getMenuCatalogApi()
      .then((items) => {
        if (!isMounted) return;
        setMenuItems(items);
        setImageUrls(Object.fromEntries(items.map((item) => [item.id, item.databaseImageUrl || getSuggestedImageUrl(item)])));
      })
      .catch((requestError) => {
        if (isMounted) setError(getApiErrorMessage(requestError, "Unable to load menu items."));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.category}`.toLowerCase().includes(query);
      return matchesSearch && (!showMissingOnly || !item.databaseImageUrl);
    });
  }, [menuItems, search, showMissingOnly]);

  const missingCount = menuItems.filter((item) => !item.databaseImageUrl).length;

  const saveImage = async (item) => {
    const imageUrl = imageUrls[item.id]?.trim();
    if (!imageUrl) {
      setError(`Add an image URL for ${item.name} first.`);
      return;
    }

    setSavingId(item.id);
    setSavedId(null);
    setError("");
    try {
      await updateMenuItemImageApi(item.id, imageUrl);
      setMenuItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, image: imageUrl, databaseImageUrl: imageUrl } : entry));
      setSavedId(item.id);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to save the image for ${item.name}.`));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4efe7] px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Menu management</p>
            <h1 className="text-3xl font-bold text-slate-900">Assign menu images</h1>
            <p className="mt-2 text-sm text-slate-600">Each missing item has a separate internet image URL ready to review and save.</p>
            <p className="mt-2 text-xs font-semibold text-orange-700">{missingCount} items still need a database image URL.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm sm:w-72">
            <Search size={18} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu items" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} />
              Show items needing images only
            </label>
          </div>
        </div>

        {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        {loading && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading menu items...</p>}
        {!loading && !filteredItems.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No menu items found.</p>}

        <div className="grid gap-5 md:grid-cols-2">
          {filteredItems.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex gap-4 p-4">
                <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {imageUrls[item.id] && <img src={imageUrls[item.id]} alt={item.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-700">ID: {item.id} · {item.category}</p>
                  <h2 className="mt-1 font-bold text-slate-900">{item.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">₹{item.price}</p>
                </div>
              </div>
              <div className="border-t border-slate-100 p-4">
                <label className="mb-2 block text-xs font-semibold text-slate-600" htmlFor={`image-${item.id}`}>Image URL</label>
                <div className="flex gap-2">
                  <input id={`image-${item.id}`} type="url" value={imageUrls[item.id] || ""} onChange={(event) => setImageUrls((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="https://example.com/dish.jpg" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-600" />
                  <button type="button" onClick={() => saveImage(item)} disabled={savingId === item.id} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                    {savingId === item.id ? <LoaderCircle size={15} className="animate-spin" /> : savedId === item.id ? <Check size={15} /> : <ImagePlus size={15} />}
                    {savedId === item.id ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
