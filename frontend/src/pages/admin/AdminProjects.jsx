import { useEffect, useRef, useState } from "react";

import {

  FolderKanban,

  Plus,

  ImagePlus,

  X,

  Pencil,

  Ban,

  Cpu,

  Trash2,

  Check,

} from "lucide-react";



import apiClient from "../../api/client";
import { softwareLabel } from "../../utils/visibleText";

import { useToastOn } from "../../components/Toast";

import "./admin-catalog-tables.css";



function createSlug(title) {

  return title

    .toLowerCase()

    .trim()

    .replace(/[^a-z0-9\s-]/g, "")

    .replace(/\s+/g, "-");

}



function AdminProjects() {

  const [projects, setProjects] = useState([]);

  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({

    title: "",

    category_id: "",

    abstract: "",

    project_type: "standard",

    level: "",

    cut_price: "",

    offer_price: "",

    is_active: true,

    is_iot: false,

    iot_kit_link: "",

    kit_price: "",

  });

  const [imageFile, setImageFile] = useState(null);

  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [confirmingId, setConfirmingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const imageInputRef = useRef(null);



  useToastOn(error, "error", setError);

  useToastOn(success, "success", setSuccess);



  const loadProjects = async () => {

    setLoading(true);

    setError("");



    try {

      const response = await apiClient.get("/admin/projects");

      const result = response.data?.data ?? response.data;



      setProjects(

        Array.isArray(result) ? result : result?.data ?? []

      );

    } catch (err) {

      setError(

        err.response?.data?.message || "Unable to load software."

      );

    } finally {

      setLoading(false);

    }

  };



  const loadCategories = async () => {

    try {

      const response = await apiClient.get("/admin/categories");

      const result = response.data?.data ?? response.data;



      setCategories(

        Array.isArray(result) ? result : result?.data ?? []

      );

    } catch (err) {

      setError(

        err.response?.data?.message || "Unable to load categories."

      );

    }

  };



  useEffect(() => {

    loadProjects();

    loadCategories();

  }, []);



  const handleChange = (event) => {

    const { name, value, type, checked } = event.target;



    setForm((current) => ({

      ...current,

      [name]: type === "checkbox" ? checked : value,

    }));

  };



  const handleImageChange = (event) => {

    const file = event.target.files?.[0] ?? null;



    setImageFile(file);

    setImagePreview(file ? URL.createObjectURL(file) : "");

  };



  const resetForm = () => {

    setForm({

      title: "",

      category_id: "",

      abstract: "",

      project_type: "standard",

      level: "",

      cut_price: "",

      offer_price: "",

      is_active: true,

      is_iot: false,

      iot_kit_link: "",

      kit_price: "",

    });

    setImageFile(null);

    setImagePreview("");

    setEditingId(null);

    if (imageInputRef.current) {

      imageInputRef.current.value = "";

    }

  };



  const handleEdit = (project) => {

    setForm({

      title: project.title ?? "",

      category_id: project.category_id ?? "",

      abstract: project.abstract ?? "",

      project_type: project.project_type ?? "standard",

      level: project.level ?? "",

      cut_price: project.cut_price ?? "",

      offer_price: project.offer_price ?? "",

      is_active: project.is_active ?? true,

      is_iot: Boolean(project.is_iot),

      iot_kit_link: project.iot_kit_link ?? "",

      kit_price: project.kit_price ?? "",

    });

    setImageFile(null);

    setImagePreview(project?.image || project?.image_url || "");

    setEditingId(project.id);

    setError("");

    setSuccess("");



    window.scrollTo({ top: 0, behavior: "smooth" });

  };



  const handleDelete = async (project) => {

    setDeletingId(project.id);



    try {

      await apiClient.delete(`/admin/projects/${project.id}`);

      if (editingId === project.id) resetForm();

      setConfirmingId(null);

      await loadProjects();

      setSuccess("Software deleted successfully.");

    } catch (err) {

      setConfirmingId(null);

      setError(err.response?.data?.message || "Unable to delete software.");

    } finally {

      setDeletingId(null);

    }

  };



  const handleSubmit = async (event) => {

    event.preventDefault();

    if (
      form.project_type === "diploma_mini" &&
      form.cut_price !== "" &&
      form.offer_price !== "" &&
      Number(form.offer_price) >= Number(form.cut_price)
    ) {
      setError("Offer price must be less than cut price.");
      return;
    }

    setSaving(true);

    setError("");

    setSuccess("");



    try {

      const payload = new FormData();



      payload.append("title", form.title.trim());

      payload.append("category_id", form.category_id);

      payload.append("abstract", form.abstract);

      payload.append("project_type", form.project_type);

      payload.append("level", form.level);

      payload.append("cut_price", form.cut_price);

      payload.append("offer_price", form.offer_price);

      payload.append("is_active", form.is_active ? "1" : "0");

      payload.append("is_iot", form.is_iot ? "1" : "0");



      if (form.is_iot) {

        payload.append("iot_kit_link", form.iot_kit_link);

        payload.append("kit_price", form.kit_price);

      }



      if (imageFile) {

        payload.append("image", imageFile);

      }



      if (editingId !== null) {

        await apiClient.post(`/admin/projects/${editingId}`, payload);

        setSuccess("Software updated successfully.");

      } else {

        await apiClient.post("/admin/projects", payload);

        setSuccess("Software created successfully.");

      }



      resetForm();

      await loadProjects();

    } catch (err) {

      const validationErrors = err.response?.data?.errors;

      const firstValidationError = validationErrors

        ? Object.values(validationErrors).flat()[0]

        : null;



      setError(

        firstValidationError ||

          err.response?.data?.message ||

          "Unable to save the software."

      );

    } finally {

      setSaving(false);

    }

  };



  return (

    <div className="student-page">

      <main className="container admin-page admin-projects-page">

        <header className="admin-header">

          <div>

            <span className="student-dashboard__eyebrow">Content management</span>

            <h1>Software</h1>

          </div>

        </header>



        <section className="admin-summary-grid" aria-label="Summary">

          <article className="admin-summary-card">

            <div className="admin-summary-card__icon">

              <FolderKanban size={20} aria-hidden="true" />

            </div>

            <div className="admin-summary-card__content">

              <span>Total software</span>

              <strong>{projects.length}</strong>

            </div>

          </article>



          <article className="admin-summary-card">

            <div className="admin-summary-card__icon">

              <Cpu size={20} aria-hidden="true" />

            </div>

            <div className="admin-summary-card__content">

              <span>IoT software</span>

              <strong>{projects.filter((p) => p.is_iot).length}</strong>

            </div>

          </article>

        </section>



        <section className="admin-panel" style={{ marginBottom: 22 }}>

          <h3>

            {editingId !== null ? (

              <Pencil size={19} aria-hidden="true" />

            ) : (

              <Plus size={19} aria-hidden="true" />

            )}

            {editingId !== null ? "Edit software" : "Add software"}

          </h3>



          <form onSubmit={handleSubmit} className="admin-project-form">

            <div className="admin-form-field">

              <label htmlFor="project-title">Software title</label>

              <input

                id="project-title"

                name="title"

                value={form.title}

                onChange={handleChange}

                maxLength={255}

                required

                placeholder="Enter software title"

              />

            </div>



            <div className="admin-form-field">

              <label htmlFor="project-category">Category</label>

              <select

                id="project-category"

                name="category_id"

                value={form.category_id}

                onChange={handleChange}

                required

              >

                <option value="">Select a category</option>

                {categories.map((category) => (

                  <option key={category.id} value={category.id}>

                    {softwareLabel(category.name, "Software")}

                  </option>

                ))}

              </select>

            </div>



            {form.title.trim() && (

              <div className="admin-project-slug-preview admin-form-field--full">

                <span>Software URL preview</span>

                <code>/projects/{createSlug(form.title)}</code>

              </div>

            )}



            <div className="admin-form-field admin-form-field--full">

              <label htmlFor="project-abstract">Software description</label>

              <textarea

                id="project-abstract"

                name="abstract"

                value={form.abstract}

                onChange={handleChange}

                rows={4}

                placeholder="Describe the software and its features"

              />

            </div>



            <div className="admin-form-field">

              <label htmlFor="project-type">Software type</label>

              <select
                id="project-type"
                name="project_type"
                value={form.project_type}
                onChange={handleChange}
                required
              >
                <option value="standard">Standard software</option>
                <option value="diploma_mini">Small Software</option>
              </select>

            </div>

            <div className="admin-form-field">

              <label htmlFor="project-level">Level</label>

              <input
                id="project-level"
                name="level"
                value={form.level}
                onChange={handleChange}
                maxLength={100}
                placeholder="e.g. Small Software"
              />

            </div>

            <div className="admin-form-field">

              <label htmlFor="project-cut-price">Cut price (₹)</label>

              <input
                id="project-cut-price"
                type="number"
                name="cut_price"
                value={form.cut_price}
                onChange={handleChange}
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="Optional"
              />

            </div>

            <div className="admin-form-field">

              <label htmlFor="project-offer-price">Offer price (₹)</label>

              <input
                id="project-offer-price"
                type="number"
                name="offer_price"
                value={form.offer_price}
                onChange={handleChange}
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="Optional"
              />

            </div>

            <label className="admin-form-check admin-form-field--full">

              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
              />

              Show this software in the public catalogue (Active)

            </label>

            <div className="admin-form-field admin-form-field--full">

              <label>Software image</label>

              <p className="admin-form-hint">

                PNG, JPG, WEBP or another supported format; maximum 5 MB.

                {editingId !== null &&

                  " Choose a new image to replace the existing one."}

              </p>



              {imagePreview ? (

                <div className="admin-image-preview">

                  <img

                    src={imagePreview}

                    alt="Software image preview"

                    onError={(event) => {

                      event.currentTarget.style.display = "none";

                    }}

                  />

                  <div className="admin-image-preview__actions">

                    <button

                      type="button"

                      className="btn btn-secondary btn-sm"

                      onClick={() => imageInputRef.current?.click()}

                    >

                      <ImagePlus size={15} aria-hidden="true" />

                      Change image

                    </button>

                    <button

                      type="button"

                      className="btn btn-secondary btn-sm"

                      onClick={() => {

                        setImageFile(null);

                        setImagePreview("");

                        if (imageInputRef.current) {

                          imageInputRef.current.value = "";

                        }

                      }}

                    >

                      <X size={15} aria-hidden="true" />

                      {imageFile ? "Remove selected image" : "Clear preview"}

                    </button>

                  </div>

                </div>

              ) : (

                <button

                  type="button"

                  className="admin-image-picker"

                  onClick={() => imageInputRef.current?.click()}

                >

                  <ImagePlus size={24} aria-hidden="true" />

                  <span>Choose software image</span>

                  <small>Click to browse files on your computer</small>

                </button>

              )}



              <input

                ref={imageInputRef}

                type="file"

                name="image"

                accept="image/*"

                onChange={handleImageChange}

                hidden

              />

            </div>



            <label className="admin-form-check admin-form-field--full">

              <input

                type="checkbox"

                name="is_iot"

                checked={form.is_iot}

                onChange={handleChange}

              />

              This is an IoT software

            </label>



            {form.is_iot && (

              <>

                <div className="admin-form-field">

                  <label htmlFor="iot-link">IoT kit guide URL</label>

                  <input

                    id="iot-link"

                    type="url"

                    name="iot_kit_link"

                    value={form.iot_kit_link}

                    onChange={handleChange}

                    placeholder="https://..."

                  />

                </div>



                <div className="admin-form-field">

                  <label htmlFor="iot-price">IoT kit price</label>

                  <input

                    id="iot-price"

                    type="number"

                    name="kit_price"

                    value={form.kit_price}

                    onChange={handleChange}

                    min="0.01"

                    max="99999999.99"

                    step="0.01"

                    placeholder="Leave empty until confirmed"

                  />

                </div>

              </>

            )}



            <div className="admin-form-actions admin-form-field--full">

              <button

                type="submit"

                className="btn btn-primary"

                disabled={saving || loading || categories.length === 0}

              >

                {editingId !== null ? (

                  <Pencil size={16} aria-hidden="true" />

                ) : (

                  <Plus size={16} aria-hidden="true" />

                )}

                {saving

                  ? "Saving..."

                  : editingId !== null

                    ? "Update software"

                    : "Create software"}

              </button>



              {editingId !== null && (

                <button

                  type="button"

                  className="btn btn-secondary"

                  onClick={resetForm}

                  disabled={saving}

                >

                  <Ban size={16} aria-hidden="true" />

                  Cancel edit

                </button>

              )}

            </div>



            {!loading && categories.length === 0 && (

              <p className="admin-form-hint admin-form-field--full">

                Create a category before adding a software.

              </p>

            )}

          </form>

        </section>



        {loading && (

          <div aria-busy="true" style={{ display: "grid", gap: 10 }}>

            {[0, 1, 2].map((i) => (

              <div key={i} className="skeleton" style={{ height: 52 }} />

            ))}

          </div>

        )}



        {!loading && projects.length === 0 && (

          <div className="empty-state">

            <span className="empty-state__icon">

              <FolderKanban size={24} aria-hidden="true" />

            </span>

            <h3>No software yet</h3>

            <p>Create your first software above.</p>

          </div>

        )}



        {!loading && projects.length > 0 && (

          <>

            <div className="admin-result-count" role="status">

              {projects.length} software

            </div>



            <div className="admin-table-wrap">

              <table className="admin-table admin-users-table">

                <thead>

                  <tr>

                    <th>Software</th>

                    <th>Category</th>

                    <th>Technology</th>

                    <th>Software kind</th>

                    <th>Price</th>

                    <th>Status</th>

                    <th>

                      <span className="admin-visually-hidden">Actions</span>

                    </th>

                  </tr>

                </thead>



                <tbody>

                  {projects.map((project, index) => {

                    const isConfirming = confirmingId === project.id;

                    const isBusy = deletingId === project.id;



                    return (

                      <tr key={project.id}>

                        <td data-label="Software">

                          <div className="project-cell">

                            <span className="project-cell__index">{index + 1}</span>

                            <div className="project-cell__text">

                              <strong>{project.title}</strong>

                            </div>

                          </div>

                        </td>



                        <td data-label="Category">{softwareLabel(project.category?.name, "—")}</td>



                        <td data-label="Technology">

                          <span className="group-chip">

                            <span className="group-chip__id">

                              {project.is_iot ? "IoT" : "Software"}

                            </span>

                          </span>

                        </td>



                        <td data-label="Software kind">

                          {project.project_type === "diploma_mini"
                            ? "Small Software"
                            : "Standard"}

                        </td>

                        <td data-label="Price">

                          {project.offer_price != null || project.cut_price != null
                            ? (
                              <>
                                {project.offer_price != null && (
                                  <strong>
                                    ₹{Number(project.offer_price).toLocaleString("en-IN")}
                                  </strong>
                                )}
                                {project.cut_price != null && (
                                  <small style={{ display: "block", textDecoration: project.offer_price != null ? "line-through" : "none" }}>
                                    ₹{Number(project.cut_price).toLocaleString("en-IN")}
                                  </small>
                                )}
                              </>
                            )
                            : project.is_iot && project.kit_price != null
                              ? `₹${Number(project.kit_price).toLocaleString("en-IN")}`
                              : "—"}

                        </td>

                        <td data-label="Status">

                          <span className="group-chip">
                            {project.is_active ? "Active" : "Inactive"}
                          </span>

                        </td>



                        <td data-label="Actions" className="admin-table__action">

                          <div className="row-actions">

                            {isConfirming ? (

                              <>

                                <span className="row-actions__ask">Delete?</span>

                                <button

                                  type="button"

                                  className="icon-btn icon-btn--danger-solid"

                                  onClick={() => handleDelete(project)}

                                  disabled={isBusy}

                                  title="Confirm delete"

                                >

                                  <Check size={16} />

                                </button>

                                <button

                                  type="button"

                                  className="icon-btn"

                                  onClick={() => setConfirmingId(null)}

                                  disabled={isBusy}

                                  title="Cancel"

                                >

                                  <X size={16} />

                                </button>

                              </>

                            ) : (

                              <>

                                <button

                                  type="button"

                                  className="icon-btn"

                                  onClick={() => handleEdit(project)}

                                  disabled={saving}

                                  title="Edit"

                                >

                                  <Pencil size={15} />

                                </button>

                                <button

                                  type="button"

                                  className="icon-btn icon-btn--danger"

                                  onClick={() => setConfirmingId(project.id)}

                                  disabled={saving}

                                  title="Delete"

                                >

                                  <Trash2 size={15} />

                                </button>

                              </>

                            )}

                          </div>

                        </td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </>

        )}

      </main>

    </div>

  );

}



export default AdminProjects;
