import meetingModel from "../models/meetingModel.js";  


export const formMeeting = (req, res) => {
    res.render("inputrapat");
};

export const showMeeting = async(req, res) => {
    const meetings = await meetingModel.getAllMeeting();
    res.render("meeting",{meetings});
    
};

export const inputMeeting = async (req,res) => {
    const {m_nama,deskripsi,tanggal,m_tipe} = req.body;

    await meetingModel.createMeeting({m_nama,deskripsi,tanggal,m_tipe});

    res.redirect("/manajemenmeeting");
}